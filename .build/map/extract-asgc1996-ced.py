#!/usr/bin/env python3
# Historical-map warning: this ABS vintage contains later WA geometry. Do not use
# it as the 2 March 1996 election frame; see README-history.md and handbook_geo.mjs.
"""ASGC 1996 GeoPackage -> n-1996.geojson for the /map/ 1996 federal frame.

The 1996 election's division geometry is the ABS's own
commonwealth_electoral_division_1996 layer in
  matilda cache: .matilda/seifa-irsad-abs/dl/asgc/asgc1996.gpkg
  fetch:  https://data.gov.au/data/dataset/55193178-3454-4a33-8151-c491e8a93172\
/resource/571eb999-29fb-4e8a-967d-54a7261982f1/download/asgc1996.gpkg
  (631,566,336 bytes)   sha256 42a46d794b0a363ae56b1b84e609234125152a26e0ed6c145180fdf7b95d7107
(the data.gov.au "ASGC (1996 Edition) - Boundaries" package, ABS Geospatial
Solutions). The AEC's map-api.aec.gov.au Electoral-era layers are raster
tiles (no WFS), so - as with 2001 - ABS ASGC is the committed source; the
AEC deep-history WMTS is never the geometry lane. Do not switch era recipes.

Vintage check (AEC redistribution register, research_paper4.pdf,
"redistributions 1901-2003", fetched 2026-10-29): the register's
determination grid lists nothing for 1995 or 1996 at all, so no
redistribution determination took effect between election day 1996-03-02
and the edition's 1996-07-01 effective date; the ASGC-1996 layer's era IS
the election-era set (the 1994 round's 148 divisions: Namadgi created by
the ACT determination of 20 Dec 1994, first contested 2 Mar 1996). The
next round that changes it opens in 1997 (10 Dec 1997 QLD - Blair; ACT
10 Dec 1997 - Namadgi abolished) - the /map/ 1998 frame's vintage problem,
recorded here so the phase-2 extractor is born knowing it.

The pack's row set is 157: 148 electoral divisions + 9 census-scaffold
pseudo-rows - seven "Migratory - Offshore - Shipping (<ST>)" (one per
state except ACT) and two external-territory fold-in markers
("Incl. in Fraser - ACT 802" = Jervis Bay Territory, "Incl. in Northern
Territory 701" = Christmas/Cocos). All nine are EXCLUDED here - they are
census scaffolds, not electoral divisions. The layer also misprints two
names ("Coragamite" for Corangamite, "McEwan" for McEwen), canonicalised by
CANON below - the same-edition row, never a rejoined feature. The final
gate is name-set equality against data/division-results.json's certified
1996 block (the AEC's own DIVS.TXT names): any drift stops the build.

usage: python3 .build/map/extract-asgc1996-ced.py [gpkg] [out]
"""
import json, re, sqlite3, struct, os, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GPKG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    REPO, ".matilda", "seifa-irsad-abs", "dl", "asgc", "asgc1996.gpkg")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    REPO, ".matilda", "map-boundary-src", "n-1996.geojson")
DIVS_JSON = os.path.join(REPO, "data", "division-results.json")
ELECTION = "1996"

# census-scaffold pseudo-rows (not electoral divisions)
EXCL_RE = re.compile(r"^(Migratory - Offshore - Shipping \(|Incl\. in )")
# the layer's two printed misspellings -> certified names
CANON = {"Coragamite": "Corangamite", "McEwan": "McEwen"}
EXPECTED_FEATURES, EXPECTED_DROPPED, EXPECTED_ROWS = 148, 9, 157


def parse_geom(blob):
    """gpkg geometry blob -> geojson geometry (pure-WKB multi/polygon)."""
    if blob is None:
        return None
    magic, ver, flags = blob[0:2], blob[2], blob[3]
    assert magic == b"GP", "bad gpkg magic"
    env_kind = (flags >> 1) & 0x7
    off = 8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env_kind]
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
    raise ValueError("unsupported wkb type %d" % t)


def key(s):
    return re.sub(r"[^a-z]", "", s.lower())


def main():
    assert os.path.exists(GPKG), ("asgc1996.gpkg not found at %s — fetch per the "
                                  "header comment (%d bytes, sha256 42a46d794b0a…)"
                                  % (GPKG, 631566336))
    con = sqlite3.connect("file:" + GPKG + "?mode=ro", uri=True)
    (n_rows,) = con.execute("SELECT count(*) FROM commonwealth_electoral_division_1996").fetchone()
    assert n_rows == EXPECTED_ROWS, f"the era layer should be {EXPECTED_ROWS} rows, got {n_rows} - is this the wrong edition/era?"
    feats, dropped = [], []
    for (obj, shp, code, name, ste_code, ste) in con.execute(
            "SELECT OBJECTID, SHAPE, CED_CODE_1996, CED_NAME_1996, "
            "STE_CODE_1996, STE_NAME_1996 FROM commonwealth_electoral_division_1996 "
            "ORDER BY STE_NAME_1996, CED_NAME_1996"):
        if EXCL_RE.search(name or ""):
            dropped.append((name, ste))
            continue
        g = parse_geom(shp)
        assert g, f"null geometry for {name}"
        typ, coords = g
        # sanity: coordinates inside the AUS+external-territories envelope
        # (Sydney carries Lord Howe to 159.1E; Lingiari's analogue at 1996 is
        # the same Cocos-bearing NT seat — geo_build's bbox clip + islands.json
        # insets handle the externals from here on, same as every frame.)
        xs = [pt[0] for poly in (coords if typ == "MultiPolygon" else [coords]) for ring in poly for pt in ring]
        ys = [pt[1] for poly in (coords if typ == "MultiPolygon" else [coords]) for ring in poly for pt in ring]
        assert 95 < min(xs) and max(xs) < 160.5, name
        assert -45 < min(ys) and max(ys) < -8.5, name
        name = CANON.get(name, name)
        feats.append({"type": "Feature", "properties": {"name": name},
                      "geometry": {"type": typ, "coordinates": coords}})
    assert len(feats) == EXPECTED_FEATURES, \
        f"expected {EXPECTED_FEATURES} divisions after exclusions, got {len(feats)}"
    assert len(dropped) == EXPECTED_DROPPED, \
        f"expected the 7 offshore + 2 fold-in pseudo-rows, got {len(dropped)}"
    # the certified name-set gate: the ABS layer must carry exactly the
    # AEC-certified 1996 division set (data/division-results.json, DIVS.TXT).
    divs = json.load(open(DIVS_JSON))
    certified = {key(n) for n in divs["elections"][ELECTION]}
    got = {key(f["properties"]["name"]) for f in feats}
    extra, missing = sorted(got - certified), sorted(certified - got)
    assert not extra and not missing, \
        f"ASGC-1996 name set != certified {ELECTION} set: extra={extra[:4]} missing={missing[:4]}"
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f, separators=(",", ":"))
    print(OUT, len(feats), "features (canon:", ", ".join(sorted(CANON)),
          "| excluded:", ", ".join(sorted({d[1] for d in dropped})), ")")


if __name__ == "__main__":
    main()
