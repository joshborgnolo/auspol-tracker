#!/usr/bin/env python3
"""derive-sa-ced2013.py — South Australia's 2011-census SA1s allocated to the
divisions the 2013 federal election was fought on.

WHY (flows-explained review, 2026-10-25): the 2013 division SEIFA lanes join
the ABS SEIFA 2011 SA1 cube to the ABS CED_2011 allocation, the boundaries in
force at the August 2011 census. South Australia was redistributed after it
(determined 16 December 2011; at least seven of eleven seats changed), and
the 2013 election ran on the new lines. No SA division name changed, so the
name-exact gates the lanes carry could never see it. Every other state's
CED_2011 edition IS its 2013 edition (NSW 2009, VIC 2010, QLD 2009, WA 2008,
TAS 2009, NT 2008, ACT 2004 redistributions), so SA alone is overridden.

SOURCE: the AEC's own boundary file for that redistribution,
https://www.aec.gov.au/Electorates/gis/files/sa-esri-16122011.zip (listed on
https://www.aec.gov.au/electorates/gis/gis_datadownload.htm as "South
Australia, 2011 redistribution, applied 2013, 2016"), cached under
.matilda/seifa-irsad-abs/dl/aec-sa-2011/, against the ABS ASGS 2011 SA1
polygons (1270055001_sa1_2011_aust_shape.zip, the cache the booth lanes use).
Both are GDA94 geographic.

METHOD: whole-SA1 allocation, matching the ABS CED_2011 allocation the other
states keep (an SA1 sits in one division). Each SA SA1 is sampled on a 6x6
grid over its bounding box; the points inside the SA1 are tested against the
eleven division polygons and the SA1 goes to the division holding most of
them (an SA1 too small for any grid point to land inside it falls back to its
first vertex). The AEC built the 2011 lines from 2006 census collection
districts, so a few SA1s straddle a boundary; the split count is printed and
pinned in the output.

Writes .build/analysis/seat-model/seifa-src/sa1-2011-sa-ced2013.json:
{"_about": ..., "divisions": [11 names], "split": n,
 "sa1": {SA1_MAINCODE_2011: division name}}
consumed by derive-division-seifa-abs.py, derive-division-seifa-interp.py
and .build/analysis/seifa-index/derive-irsad.py through ced2013_sa_override().

Run from the repo root:
    python3 .build/analysis/seat-model/derive-sa-ced2013.py
"""
import collections
import json
import os
import struct
import sys
import zipfile
from array import array

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = HERE.rsplit("/.build/", 1)[0]
DL = f"{PROJ}/.matilda/seifa-irsad-abs/dl"
AEC_ZIP = f"{DL}/aec-sa-2011/sa-esri-16122011.zip"
SA1_ZIP = f"{DL}/1270055001_sa1_2011_aust_shape.zip"
OUT = f"{HERE}/seifa-src/sa1-2011-sa-ced2013.json"
CLASS_JSON = f"{PROJ}/data/division-classifications.json"
GRID = 6
BANDS = 4000


def fail(msg):
    sys.exit(f"derive-sa-ced2013: {msg}")


def dbf_rows(buf):
    nrec, hlen, rlen = struct.unpack_from("<IHH", buf, 4)
    fields, off, pos = [], 32, 1
    while buf[off] != 0x0D:
        fields.append((buf[off:off + 11].split(b"\x00")[0].decode("ascii"), pos, buf[off + 16]))
        pos += buf[off + 16]
        off += 32
    for i in range(nrec):
        rec = buf[hlen + i * rlen: hlen + (i + 1) * rlen]
        yield {n: rec[p:p + l].decode("latin-1").strip() for n, p, l in fields}


def shp_polygons(buf):
    """(box, rings) per record, None for a null shape."""
    if struct.unpack_from(">i", buf, 0)[0] != 9994 or struct.unpack_from("<i", buf, 32)[0] != 5:
        fail("not a polygon shapefile")
    off = 100
    while off < len(buf):
        _rec, clen = struct.unpack_from(">2i", buf, off)
        off += 8
        content = buf[off:off + clen * 2]
        off += clen * 2
        if struct.unpack_from("<i", content, 0)[0] == 0:
            yield None
            continue
        box = struct.unpack_from("<4d", content, 4)
        nparts, npts = struct.unpack_from("<2i", content, 36)
        parts = struct.unpack_from(f"<{nparts}i", content, 44)
        pts = array("d", struct.unpack_from(f"<{npts * 2}d", content, 44 + 4 * nparts))
        yield box, [pts[2 * parts[i]: 2 * (parts[i + 1] if i + 1 < nparts else npts)]
                    for i in range(nparts)]


def inside(x, y, rings):
    """Even-odd over every ring (holes included)."""
    hit = False
    for ring in rings:
        j = len(ring) - 2
        for i in range(0, len(ring), 2):
            yi, yj = ring[i + 1], ring[j + 1]
            if (yi > y) != (yj > y):
                xi, xj = ring[i], ring[j]
                if x < xi + (y - yi) / (yj - yi) * (xj - xi):
                    hit = not hit
            j = i
    return hit


class Banded:
    """A division polygon with its edges bucketed by latitude band, so a
    ray cast only walks the edges that can cross the point's y."""

    def __init__(self, box, rings):
        self.box = box
        self.y0, self.h = box[1], (box[3] - box[1]) / BANDS or 1e-12
        self.bands = collections.defaultdict(list)
        for ring in rings:
            j = len(ring) - 2
            for i in range(0, len(ring), 2):
                e = (ring[i], ring[i + 1], ring[j], ring[j + 1])
                lo, hi = sorted((e[1], e[3]))
                for b in range(int((lo - self.y0) / self.h), int((hi - self.y0) / self.h) + 1):
                    self.bands[b].append(e)
                j = i

    def contains(self, x, y):
        b = self.box
        if not (b[0] <= x <= b[2] and b[1] <= y <= b[3]):
            return False
        hit = False
        for xi, yi, xj, yj in self.bands.get(int((y - self.y0) / self.h), ()):
            if (yi > y) != (yj > y) and x < xi + (y - yi) / (yj - yi) * (xj - xi):
                hit = not hit
        return hit


def main():
    za = zipfile.ZipFile(AEC_ZIP)
    shp = next(n for n in za.namelist() if n.lower().endswith(".shp"))
    dbf = next(n for n in za.namelist() if n.lower().endswith(".dbf"))
    names = [r["ELECT_DIV"] for r in dbf_rows(za.read(dbf))]
    divs = [(nm, Banded(*poly)) for nm, poly in zip(names, shp_polygons(za.read(shp))) if poly]
    want = sorted(n for n, r in json.load(open(CLASS_JSON))["elections"]["2013"].items() if r["state"] == "SA")
    if sorted(names) != want:
        fail(f"AEC SA 2011 divisions {sorted(names)} != the 2013 SA classification block {want}")

    zs = zipfile.ZipFile(SA1_ZIP)
    rows = list(dbf_rows(zs.read("SA1_2011_AUST.dbf")))
    out, split, fallback, unplaced = {}, 0, 0, []
    for row, poly in zip(rows, shp_polygons(zs.read("SA1_2011_AUST.shp"))):
        if row["STE_CODE11"] != "4" or poly is None:
            continue
        box, rings = poly
        votes = collections.Counter()
        for gx in range(GRID):
            for gy in range(GRID):
                x = box[0] + (gx + 0.5) * (box[2] - box[0]) / GRID
                y = box[1] + (gy + 0.5) * (box[3] - box[1]) / GRID
                if not inside(x, y, rings):
                    continue
                for nm, d in divs:
                    if d.contains(x, y):
                        votes[nm] += 1
                        break
        if not votes:
            fallback += 1
            x, y = rings[0][0], rings[0][1]
            for nm, d in divs:
                if d.contains(x, y):
                    votes[nm] += 1
                    break
        if not votes:
            unplaced.append(row["SA1_MAIN11"])
            continue
        if len(votes) > 1:
            split += 1
        out[row["SA1_MAIN11"]] = votes.most_common(1)[0][0]
    if unplaced:
        fail(f"{len(unplaced)} SA SA1s fell in no division: {unplaced[:5]}")
    per = collections.Counter(out.values())
    if set(per) != set(names):
        fail(f"a division received no SA1: {sorted(set(names) - set(per))}")
    doc = {"_about": ("South Australia's ASGS 2011 SA1s (SA1_MAINCODE_2011) allocated whole to the "
                      "divisions of the AEC's 16 December 2011 SA redistribution (the 2013 election's "
                      "boundaries), by majority of a 6x6 grid sample against the AEC boundary file "
                      "sa-esri-16122011.zip. Generated by derive-sa-ced2013.py."),
           "source": "https://www.aec.gov.au/Electorates/gis/files/sa-esri-16122011.zip",
           "divisions": sorted(names), "sa1Count": len(out), "split": split,
           "fallback": fallback, "sa1": dict(sorted(out.items()))}
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=0)
        f.write("\n")
    print(f"SA SA1s {len(out)} -> {len(per)} divisions; {split} straddle a boundary; "
          f"{fallback} by first vertex; wrote {OUT}")
    for nm, n in sorted(per.items()):
        print(f"  {nm:<12} {n}")


if __name__ == "__main__":
    main()
