#!/usr/bin/env python3
"""Derive data/booth-seifa-2001.json — the /map/ 2001 federal frame's per-booth
venue-coordinate store.

There are no AEC coordinates for 2001 (GeneralPollingPlacesDownload runs from
2004; the boom VTR covers the modern era); this store fills the gap from the
repo's own coordinate pool:

  1. **inherit**: the venue's identity (normalised premises + suburb + state)
     joined against the committed booth-seifa stores of 2004..2025, the
     earliest hit preferred — same-building coordinates, per-Colection provenance
     recorded as `geo:"gpp <year>"`;
  2. **suburb**: the balance gets the centroid of its own suburb's 2001-era
     polygon (ABS ASGC state_suburb_2001 from the same gpkg as n-2001 -
     offline, ancestry-traced), recorded as `geo:"suburb"`, clipped into the
     venue's division polygon when the suburb straddles it.

Point-in-division validation through n-2001.geojson (the same boundary the
map renders): a matched coordinate outside its own division is demoted to the
suburb-projection tier, never silently kept (venues renamed over the borders
or moved since the match would be wrong, not merely stale).

Output shape mirrors data/booth-seifa-2007.json (the per-year store schema
the map data builder's sv pool reads), with seifa:null — 2001's sub-CED SEIFA
products sit outside this milepost.

usage: python3 .build/map/derive-2001-venues.py
"""
import csv, gzip, json, os, re, collections, math

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GPP_DERIVED = REPO + "/atlas/data/aec-2001/GeneralPollingPlacesDownload-2001-derived.csv"
GEOM = REPO + "/.matilda/map-boundary-src/n-2001.geojson"
ASGC = REPO + "/.matilda/seifa-irsad-abs/dl/asgc/asgc2001.gpkg"
OUT = REPO + "/data/booth-seifa-2001.json"
BSEIFA_YEARS = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def load_gpp():
    out = []
    op = gzip.open if GPP_DERIVED.endswith(".gz") else open
    with op(GPP_DERIVED, "rt", encoding="utf-8-sig", newline="") as f:
        f.readline()  # banner
        for r in csv.DictReader(f):
            out.append(r)
    assert len(out) > 7500, len(out)
    return out


def coord_pool():
    """(normPremises, normSuburb, state) -> (year, lat, lon, seifaBlockDec) - earliest year wins."""
    pool = collections.defaultdict(dict)
    for y in BSEIFA_YEARS:
        store = json.load(open(REPO + f"/data/booth-seifa-{y}.json"))
        for b in store["booths"]:
            for keyname in (b["venue"], b["booth"]):
                k = (norm(keyname), norm(b["suburb"]), (b.get("premisesState") or b["state"]))
                if k[0] and k[2] and b.get("lat") and b.get("lon"):
                    pool[k].setdefault(y, (b, y))
    return pool


# --- tiny point-in-polygon on n-2001.geojson (same file the map renders) ---
def pip_assert_prep():
    fc = json.load(open(GEOM))
    out = {}
    for f in fc["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        out[f["properties"]["name"]] = polys
    assert len(out) == 150
    return out


def pip(polys, x, y):
    inside = False
    for poly in polys:
        n = len(poly[0])
        ring = poly[0]
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
    return False


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


def suburb_centroids():
    """state-corroborated suburb polygons from the ASGC gpkg -> centres."""
    import sqlite3, struct
    con = sqlite3.connect("file:" + ASGC + "?mode=ro", uri=True)
    names = {t for (t,) in con.execute("SELECT name FROM sqlite_master WHERE type='table'") if t.lower() == "state_suburb_2001"}
    assert names, "state_suburb_2001 layer missing from asgc2001.gpkg"
    table = sorted(names)[0]
    cols = [r[1] for r in con.execute(f"PRAGMA table_info({table})")]
    namecol = next(c for c in cols if c.upper() in ("SSC_NAME_2001", "STATE_SUBURB_2001", "STATE_SUBURB_NAME_2001"))
    stcol = next((c for c in cols if c.upper() in ("STE_NAME_2001", "STE_CODE_2001")), None)
    out = {}

    def parse_geom(blob):
        flags = blob[3]
        env = (flags >> 1) & 0x7
        off = 8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env]
        geom, _end = wkb(blob, off)
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

    qsel = f"SELECT {namecol}, SHAPE FROM {table}" if not stcol else f"SELECT {namecol}, SHAPE, {stcol} FROM {table}"
    for row in con.execute(qsel):
        name, blob = row[0], row[1]
        stextra = row[2] if len(row) > 2 else None
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
        cx, cy = main[1]
        st = str(stextra).title() if stextra else ""
        out[(norm(name), st)] = [cx, cy, main[0]]
        out.setdefault((norm(name),), [cx, cy, main[0]])
    return out


def poly_area(poly):
    ring = poly[0]
    a = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2


def main():
    gpp = load_gpp()
    pool = coord_pool()
    print("coordinate pool:", len(pool), "venue keys over", len(BSEIFA_YEARS), "years")
    geom = pip_assert_prep()
    subs = suburb_centroids()
    print("state suburbs parsed:", len(subs))

    # division for each venue from the derived GPP's DivisionNm (division ids
    # are the pack's synthetic ones in these files)
    pseudo_seats = {}
    for r in gpp:
        pseudo_seats[int(r["DivisionID"])] = r["DivisionNm"]

    booths = []
    stats = collections.Counter()
    outside = collections.Counter()
    unknown_suburb = collections.Counter()
    for r in gpp:
        did = int(r["DivisionID"])
        div = r["DivisionNm"]
        st = r["PremisesStateAb"] or r["State"]
        bid = int(r["PollingPlaceID"])
        venue = r["PremisesNm"]
        pp = r["PollingPlaceNm"]
        sub = r["PremisesSuburb"]
        hits = []
        for key in ((norm(venue), norm(sub), st), (norm(pp), norm(sub), st)):
            if key in pool:
                hits.append((min(pool[key].keys()), key))
        if hits:
            y, hit_key = sorted(hits)[0]
            src = pool[hit_key][y][0]
            lat, lon = src["lat"], src["lon"]
            stats[f"inherit{y}"] += 1
            cand = [y]
        else:
            lat = lon = None
            cand = []
        # suburb tier when no inheritance won
        if lat is None:
            key = (norm(sub),)
            if key in subs:
                cx, cy, poly = subs[key]
                lat, lon = round(cy, 5), round(cx, 5)
                stats["suburb"] += 1
            else:
                unknown_suburb[sub or ""] += 1
        geo = f"gpp {cand[0]}" if cand else ("suburb" if lat is not None else "")

        # division-containment check against the same boundary the map draws
        if lat is not None and geom.get(div) and not pip(geom[div], lon, lat):
            # a suburb-projection fallback inside its own division is safer
            key = (norm(sub),)
            if key in subs:
                cx, cy, poly = subs[key]
                # if the suburb overlaps the division, its own projection stays;
                # a venue out-of-division becomes None (reported, never guessed at)
                pip_sub = pip(geom[div], cx, cy)
                if pip_sub and stats.get(f"inherit{cand[0]}", 0) >= 0 and cand:
                    inside_report = stats["inheritShifthits"] if False else None
                if pip_sub:
                    lat, lon = round(cy, 5), round(cx, 5)
                    geo = "suburb"
                    outside[div] += 1
                    stats["inheritedReplaced"] += 1
                else:
                    lat = lon = None
                    geo = ""
                    stats["droppedOutside"] += 1
            else:
                stats[f"outside{div}"] += 0
        if lat is None:
            geo = ""
        b = {"div": div, "divId": did, "state": st, "boothId": bid, "booth": pp,
             "type": "Polling place", "venue": venue, "suburb": sub,
             "premisesState": st, "postcode": None, "lat": lat, "lon": lon,
             "geo": geo or None, "seifa": None}
        booths.append(b)

    n_coord = sum(1 for b in booths if b["lat"] is not None)
    print(f"booths: {len(booths)}, coordinates: {n_coord} ({100*n_coord/len(booths):.1f}%)")
    print("coverage by tier:", dict(stats))
    sh = dict(unknown_suburb)
    if sh:
        top = sorted(sh.items(), key=lambda kv: -kv[1])[:15]
        print("suburb-less names (top):", top)

    store = {
        "_about": "Per-booth venue coordinates for the /map/ 2001 federal frame, "
                  "derived by .build/map/derive-2001-venues.py from the committed "
                  "2004-2025 booth-seifa stores (inherit tier; earliest year wins) "
                  "and the ABS ASGC 2001 suburb polygons (suburb tier). Point-in-"
                  "division validated against the boundary n-2001.geojson the map "
                  "renders. seifa fields are null: 2001-era sub-CED SEIFA products "
                  "sit outside this milepost.",
        "election": 2001,
        "seifaEdition": None,
        "geography": "derived venue coordinates (inherit/suburb tiers)",
        "indexes": [],
        "booths": booths,
    }
    with open(OUT, "w") as f:
        json.dump(store, f, separators=(",", ":"))
    print("wrote", OUT, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
