#!/usr/bin/env python3
"""ASGC 2001 GeoPackage -> n-2001.geojson for the /map/ 2001 federal frame.

The 2001 election's division geometry is the ABS's own
Commonwealth_Electoral_Division_2001 layer in
  matilda cache: .matilda/seifa-irsad-abs/dl/asgc/asgc2001.gpkg
  fetch:  https://data.gov.au/data/dataset/0b939a62-e53e-4616-add5-77f909b58ddd\
/resource/0cbf7d76-1094-4cb3-8af6-e6088be4e72b/download/asgc2001.gpkg
  (963,979,264 bytes)   sha256 c94c4f17855a367ef7ab4024d7fe03a116b8634d93fcf46f04c19b11f4e658f0
(the data.gov.au "ASGC (2001 Edition) - Boundaries" package, ABS Geospatial
Solutions). The AEC's own map-api.aec.gov.au Electoral_2001_CED WMTS was the
first-choice source; it has no A record since 2026-10-23 and its tiles are
raster anyway, so ABS ASGC is the committed source. The 2004/2007 federal
eras still come from the AEC MIF sets (COM20040430_elb.zip etc.) — do not
switch era recipes.

Layer used: Commonwealth_Electoral_Division_2001 (MULTIPOLYGON, EPSG:4283
GDA94, lub-billable coordinate order). The pack's row set is 157:
150 electoral divisions + 7 "Off-Shore, Shipping and Migratory" ABS
collection pseudo-rows (one per state except ACT). The seven are EXCLUDED
here — they are census scaffolds, not electoral divisions, and geo_build's
name-set gate would (rightly) fail the file on them. The ABS name variants
"Mcewen/Mcmillan/Mcpherson" pass the boundary gate as-is because both the
ABS and AEC spellings collapse to the same letters under
key = s.toLowerCase().replace(/[^a-z]/g, "").

Output: FeatureCollection[name=CED_NAME_2001] per division — the same
single-national-file, name-only-properties shape the MIF recipe emits for
2004/2007, so geo_build consumes it unchanged.
usage: python3 .build/map/extract-asgc2001-ced.py [gpkg] [out]
"""
import json, sqlite3, struct, os, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GPKG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    REPO, ".matilda", "seifa-irsad-abs", "dl", "asgc", "asgc2001.gpkg")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    REPO, ".matilda", "map-boundary-src", "n-2001.geojson")
EXCL = "Off-Shore, Shipping and Migratory"


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


def main():
    assert os.path.exists(GPKG), ("asgc2001.gpkg not found at %s — fetch per the "
                                  "header comment (%d bytes, sha256 c94c4f17855a…)"
                                  % (GPKG, 963979264))
    con = sqlite3.connect("file:" + GPKG + "?mode=ro", uri=True)
    feats, dropped = [], []
    for (obj, shp, code, name, ste_code, ste) in con.execute(
            "SELECT OBJECTID, SHAPE, CED_CODE_2001, CED_NAME_2001, "
            "STE_CODE_2001, STE_NAME_2001 FROM Commonwealth_Electoral_Division_2001 "
            "ORDER BY STE_NAME_2001, CED_NAME_2001"):
        if name == EXCL:
            dropped.append((name, ste))
            continue
        g = parse_geom(shp)
        assert g, f"null geometry for {name}"
        typ, coords = g
        # sanity: coordinates inside the AUS+external-territories envelope.
        # (Sydney carries Lord Howe to 159.1E; Lingiari carries the Cocos
        # group to 96.8W-east — geo_build's bbox clip + islands.json insets
        # handle them from here on, same as the modern frames.)
        xs = [pt[0] for poly in (coords if typ == "MultiPolygon" else [coords]) for ring in poly for pt in ring]
        ys = [pt[1] for poly in (coords if typ == "MultiPolygon" else [coords]) for ring in poly for pt in ring]
        assert 95 < min(xs) and max(xs) < 160.5, name
        assert -45 < min(ys) and max(ys) < -8.5, name
        feats.append({"type": "Feature", "properties": {"name": name},
                      "geometry": {"type": typ, "coordinates": coords}})
    assert len(feats) == 150, f"expected 150 divisions after exclusions, got {len(feats)}"
    assert len(dropped) == 7, f"expected the 7 offshore pseudo-rows, got {len(dropped)}"
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f, separators=(",", ":"))
    print(OUT, len(feats), "features (excluded:", ", ".join(sorted({d[1] for d in dropped})), ")")


if __name__ == "__main__":
    main()
