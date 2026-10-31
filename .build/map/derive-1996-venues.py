#!/usr/bin/env python3
"""LEGACY: /map/ now overrides these coordinates with the common 1993/96/98
matcher in historical_booth_locations.py, using corrected Handbook boundaries.
This file retains the earlier store recipe for reproducibility.

SUPERSEDED 2026-10-31 wholly: data/booth-seifa-1996.json is now written by
.build/analysis/seat-model/derive-booth-seifa-stats90s.py in the frame's own
booth registry (the history-location store's, asserted equal to the assembled
frame's composite ids) with the SEIFA lane filled against the AURIN
seifa_cd_1996 cube; this script's store recipe survives as the venue-pool
reference for its coordinate prose only.

Derive data/booth-seifa-1996.json — the /map/ 1996 federal frame's per-booth
venue-coordinate store.

The 1996 pack carries no polling-place roll (only PPSNUM96 counts) and no
AEC coordinates (GeneralPollingPlacesDownload runs from 2004), so this
store fills the lane from the repo's own coordinate pool:

  1. **inherit**: the venue/place name (normalised, state-scoped, requiring
     an UNAMBIGUOUS point — repeated-name venues across the state drop out
     rather than risk a kilometre-scale wrong dot) joined against the
     committed booth-seifa stores of 2004-2025, the earliest year winning —
     provenance recorded as `geo:"gpp <year>"`;
  2. **suburb**: the balance whose premises name contains a suburb name
     from the ABS ASGC 1996 gazetteer (state_suburb_1996, the same gpkg as
     n-1996) gets its suburb's 1996 polygon centroid, recorded as
     `geo:"suburb"`, and only if that centroid lands inside the venue's own
     division polygon (pip check).

Point-in-division validation through n-1996.geojson (the same boundary the
map renders): an inherited coordinate outside its own division demotes to
the suburb tier and finally to None, never silently kept (a venue that
moved suburbs since its match would be wrong, not merely stale).

Output shape mirrors data/booth-seifa-2001.json (the per-year store schema
the map data builder's sv pool reads), with seifa:null and suburb:null —
1996's sub-CED SEIFA products and venue-roll suburbs both sit outside this
milepost.

usage: python3 .build/map/derive-1996-venues.py [asgc1996.gpkg]
"""
import collections, csv, json, os, re, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GPP_DERIVED = REPO + "/atlas/data/aec-1996/GeneralPollingPlacesDownload-1996-derived.csv"
GEOM = REPO + "/.matilda/map-boundary-src/n-1996.geojson"
ASGC = sys.argv[1] if len(sys.argv) > 1 else REPO + "/.matilda/seifa-irsad-abs/dl/asgc/asgc1996.gpkg"
OUT = REPO + "/data/booth-seifa-1996.json"
BSEIFA_YEARS = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def load_gpp():
    out = []
    with open(GPP_DERIVED, encoding="utf-8-sig", newline="") as f:
        f.readline()
        for r in csv.DictReader(f):
            out.append(r)
    assert len(out) > 7500, len(out)
    return out


def coord_pool():
    """(normPremises, premisesState) -> {year: (booth, lat, lon)} earliest year wins."""
    pool = collections.defaultdict(dict)
    for y in BSEIFA_YEARS:
        store = json.load(open(REPO + f"/data/booth-seifa-{y}.json"))
        for b in store["booths"]:
            for keyname in (b["venue"], b["booth"]):
                st = b.get("premisesState") or b["state"]
                k = (norm(keyname), st)
                if k[0] and st and b.get("lat") and b.get("lon"):
                    pool[k].setdefault(y, (b, b["lat"], b["lon"]))
    return pool


KMSLACK = 0.0005  # ~50m tolerance for treating two stored points as the same venue


def pip(polys, x, y):
    inside_any = False
    for poly in polys:
        ring = poly[0]
        n = len(ring)
        j = n - 1
        inside = False
        for i in range(n):
            xi, yi = ring[i]
            xj, yj = ring[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                inside = not inside
            j = i
        if inside:
            return True
    return inside_any


def centroid_of(poly):
    a = 0.0
    rx = ry = 0.0
    ring = poly[0]
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        cr = x1 * y2 - x2 * y1
        a += cr
        rx += (x1 + x2) * cr
        ry += (y1 + y2) * cr
    a *= 0.5
    if abs(a) < 1e-12:
        return None
    return [rx / (6 * a), ry / (6 * a)]


def poly_area(poly):
    ring = poly[0]
    a = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2


def parse_div_polygons():
    fc = json.load(open(GEOM))
    out = {}
    for f in fc["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        out[f["properties"]["name"]] = polys
    assert len(out) == 148
    return out


def suburb_centroids():
    """Locality gazetteers inside asgc1996.gpkg -> {(norm name, state): centroid}.
    Sources: state_suburb_1996 (the 1996 SSC - SA/WA/TAS only in this edition)
    and urban_centre_and_locality_1996 (UCL, national), with '(L)' and
    '(X Part)' suffixes stripped. Suburb polygons win ties over UCL names
    (they're the resolution booths read as suburbs)."""
    import sqlite3, struct
    con = sqlite3.connect("file:" + ASGC + "?mode=ro", uri=True)
    ST_FULL = {"new south wales": "NSW", "victoria": "VIC", "queensland": "QLD",
               "western australia": "WA", "south australia": "SA", "tasmania": "TAS",
               "northern territory": "NT", "australian capital territory": "ACT"}

    def parse_geom(blob):
        flags = blob[3]
        env = (flags >> 1) & 0x7
        off = 8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env]
        geom, _ = wkb(blob, off)
        return geom

    def wkb(b, off):
        bo = "<" if b[off] == 1 else ">"
        off += 1
        (t,) = struct.unpack_from(bo + "I", b, off)
        off += 4
        base = t % 1000
        if base == 3:
            (n,) = struct.unpack_from(bo + "I", b, off)
            off += 4
            rings = []
            for _ in range(n):
                (m,) = struct.unpack_from(bo + "I", b, off)
                off += 4
                ring = []
                for _ in range(m):
                    x, y = struct.unpack_from(bo + "dd", b, off)
                    off += 16
                    ring.append([x, y])
                rings.append(ring)
            return ["Polygon", rings], off
        if base == 6:
            (n,) = struct.unpack_from(bo + "I", b, off)
            off += 4
            polys = []
            for _ in range(n):
                g, off = wkb(b, off)
                polys.append(g[1])
            return ["MultiPolygon", polys], off
        raise ValueError(t)

    def read_layer(table, namecol, stcol):
        q = f"SELECT {namecol}, SHAPE, {stcol} FROM {table}" if stcol else f"SELECT {namecol}, SHAPE FROM {table}"
        for row in con.execute(q):
            name, blob = row[0], row[1]
            if blob is None:
                continue
            stx = row[2] if len(row) > 2 else None
            st = ST_FULL.get(str(stx).strip().lower(), str(stx).upper()[:3]) if stx is not None else ""
            name = re.sub(r"\s*\([^)]*\)\s*$", "", name or "").strip()
            if not name:
                continue
            typ, coords = parse_geom(blob)
            polys = coords if typ == "MultiPolygon" else [coords]
            pts = []
            for poly in polys:
                c = centroid_of(poly)
                if c:
                    pts.append((poly, c))
            if not pts:
                continue
            main = max(pts, key=lambda pc: poly_area(pc[0]))
            yield (norm(name), st), main[1], main[0]

    out = {}
    # UCL first so the metropolitan suburb polygons win ties with same names
    for key, c, poly in read_layer("urban_centre_and_locality_1996", "UCL_NAME_1996", "STE_NAME_1996"):
        out.setdefault(key, [c[0], c[1], poly])
    tables = {t for (t,) in con.execute("SELECT name FROM sqlite_master WHERE type='table'")
              if t.lower() == "state_suburb_1996"}
    assert tables, "state_suburb_1996 layer missing from asgc1996.gpkg"
    table = sorted(tables)[0]
    cols = [r[1] for r in con.execute(f"PRAGMA table_info({table})")]
    namecol = next(c for c in cols if c.upper() in ("SSC_NAME_1996", "STATE_SUBURB_1996", "STATE_SUBURB_NAME_1996", "SUBURB_NAME_1996"))
    stcol = next((c for c in cols if c.upper() in ("STE_NAME_1996", "STE_CODE_1996", "STATE_CODE_1996")), None)
    for key, c, poly in read_layer(table, namecol, stcol):
        out[key] = [c[0], c[1], poly]
    return out


def main():
    gpp = load_gpp()
    pool = coord_pool()
    geom = parse_div_polygons()
    subs = suburb_centroids()
    # sorted per-state name index for strict-prefix inherit joins
    import bisect as _bi
    pool_by_state = collections.defaultdict(list)
    for (nm, st), years in pool.items():
        pool_by_state[st].append(nm)
    for st in pool_by_state:
        pool_by_state[st].sort()

    def inherit_hit(nm, st):
        """exact norm-name, else strict-prefix extensions (the 1996 short
        form is a prefix of the modern GPP name). Point must be unambiguous:
        every candidate/year agreeing to ~50m, earliest year winning."""
        if len(nm) < 4:
            return None
        keys = set()
        if (nm, st) in pool:
            keys.add((nm, st))
        if not keys:
            arr = pool_by_state.get(st, [])
            i = _bi.bisect_left(arr, nm)
            for j in range(i, len(arr)):
                if arr[j].startswith(nm):
                    keys.add((arr[j], st))
                else:
                    break
        if not keys:
            return None
        pts = set()
        for k in keys:
            for y, v in pool[k].items():
                pts.add((y, round(v[1] / KMSLACK), round(v[2] / KMSLACK)))
        if not pts:
            return None
        y = min(p[0] for p in pts)
        earn = {(p[1], p[2]) for p in pts if p[0] == y}
        if len(earn) != 1:
            return None
        cx, cy = next(iter(earn))
        return y, cx * KMSLACK, cy * KMSLACK

    # longest suburb-name-first matcher per premises string
    sub_words = sorted({n for (n, st) in subs if n}, key=len, reverse=True)

    booths = []
    stats = collections.Counter()
    ambiguous = []
    for r in gpp:
        did = int(r["DivisionID"])
        div = r["DivisionNm"]
        st = r["PremisesStateAb"] or r["State"]
        bid = int(r["PollingPlaceID"])
        venue = r["PremisesNm"]
        pp = r["PollingPlaceNm"]
        hits = []
        for keynm in dict.fromkeys((norm(venue), norm(pp))):
            h = inherit_hit(keynm, st)
            if h:
                hits.append(h)
        lat = lon = None
        geo = None
        if hits:
            y = min(h[0] for h in hits)
            pts = {(round(h[1] / KMSLACK), round(h[2] / KMSLACK)) for h in hits if h[0] == y}
            if len(pts) == 1:
                y, lat, lon = next(h for h in hits if h[0] == y)
                geo = f"gpp {y}"
                stats[f"inherit{y}"] += 1
            else:
                ambiguous.append((div, venue, pts))
        # suburb tier: premises name contains a gazetteered suburb name
        if lat is None:
            for sw in sub_words:
                if sw and sw in norm(venue):
                    cand = subs[(sw, st)] if (sw, st) in subs else subs.get((sw, ""))
                    if cand:
                        cx, cy, _poly = cand
                        if geom.get(div) and pip(geom[div], cy, cx):
                            lat, lon = round(cy, 5), round(cx, 5)
                            geo = "suburb"
                            stats["suburb"] += 1
                        else:
                            stats["suburbOutside"] += 1
                        break
        # inherit misset: demote when the inherited dot sits outside its own division
        if lat is not None and geo and geo.startswith("gpp") and geom.get(div) and not pip(geom[div], lon, lat):
            stats["inheritOutside"] += 1
            lat = lon = geo = None
            for sw in sub_words:
                if sw and sw in norm(venue):
                    cand = subs[(sw, st)] if (sw, st) in subs else subs.get((sw, ""))
                    if cand:
                        cx, cy, _poly = cand
                        if geom.get(div) and pip(geom[div], cy, cx):
                            lat, lon = round(cy, 5), round(cx, 5)
                            geo = "suburb"
                            stats["inheritDemotedToSuburb"] += 1
                        else:
                            stats["inheritDroppedOutside"] += 1
                        break
        subv = None
        booths.append({
            "div": div, "divId": did, "state": st, "boothId": bid, "booth": pp,
            "type": "Polling place", "venue": venue, "suburb": subv,
            "premisesState": st, "postcode": None, "lat": lat, "lon": lon,
            "geo": geo, "seifa": None,
        })

    n_coord = sum(1 for b in booths if b["lat"] is not None)
    print(f"booths: {len(booths)}, coordinates: {n_coord} ({100 * n_coord / len(booths):.1f}%)")
    print("coverage by tier:", dict(stats))
    print("ambiguous inherit-name venues dropped:", len(ambiguous), ambiguous[:5])

    store = {
        "_about": "Per-booth venue coordinates for the /map/ 1996 federal frame, "
                  "derived by .build/map/derive-1996-venues.py: the 1996 pack carries "
                  "no venue roll (names come from its own DOP print) and the AEC's "
                  "coordinate era starts 2004, so venue names join the committed "
                  "2004-2025 booth-seifa stores state-scoped and unambiguous-name "
                  "only (inherit tier), with the ABS ASGC 1996 suburb polygons' "
                  "centroids as the suburb tier, every surviving point pip-"
                  "validated against the same n-1996.geojson boundary the map "
                  "renders. seifa and suburb fields are null: 1996-era sub-CED "
                  "SEIFA products and a venue roll both sit outside this milepost.",
        "election": 1996,
        "seifaEdition": None,
        "geography": "derived venue coordinates (unambiguous-name inherit + 1996 suburb centroid tiers)",
        "indexes": [],
        "booths": booths,
    }
    with open(OUT, "w") as f:
        json.dump(store, f, separators=(",", ":"))
    print("wrote", OUT, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
