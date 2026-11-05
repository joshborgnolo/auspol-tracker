"""places_build.py - the towns and cities named on the Election map, as map/data/places.json.

Every ABS 2021 Urban Centre and Locality (UCL: a town of 200 people or more),
with its 2021 Census population, set at a point:
  - where GeoNames has a populated place of the same name inside (or within
    3 km of) the UCL's boundary, its point - the town centre, Sydney at the
    CBD rather than the middle of its sprawl;
  - otherwise the boundary's pole of inaccessibility (shapely polylabel).
"(L)" (a locality) is dropped; a joined centre is named by its first town
("Shepparton - Mooroopna" is "Shepparton"), and a state keeps one place of
each name, the biggest. A UCL split by a state border ("Canberra - Queanbeyan (Queanbeyan Part)")
is named for its part ("Queanbeyan"); a state tag in brackets ("Kingston
(Tas.)") is dropped. "Remainder of state", "Migratory" and "No usual address"
rows are not places.

Sources (not in the repo, ~60MB; fetch into one directory):
  UCL_2021_AUST_GDA2020_SHP.zip  abs.gov.au ASGS Edition 3, digital boundary files
  2021_GCP_UCL_for_AUS_short-header.zip  abs.gov.au Census DataPacks (G01, Tot_P_P)
  AU.zip  download.geonames.org/export/dump (CC BY 4.0)
Needs pyshp and shapely.

usage: python3 .build/map/places_build.py <srcDir> map/data/places.json
Then: node .build/map/assemble.mjs (the data stamp).
Output: {"src": ..., "p": [[name, lon, lat, pop, state, [west, south, east, north]], ...]}
biggest first; the box is the UCL boundary's extent (what the map frames when the
town is chosen in the search).
"""
import csv, io, json, re, sys, zipfile
from collections import defaultdict

import shapefile
from shapely.geometry import Point, shape
from shapely.ops import polylabel
from shapely.prepared import prep

src, out = sys.argv[1], sys.argv[2]
STATE = {"1": "NSW", "2": "VIC", "3": "QLD", "4": "SA", "5": "WA", "6": "TAS", "7": "NT", "8": "ACT", "9": "OT"}

pop = {}
with zipfile.ZipFile(f"{src}/2021_GCP_UCL_for_AUS_short-header.zip") as z:
    name = next(n for n in z.namelist() if n.endswith("G01_AUST_UCL.csv"))
    for row in csv.DictReader(io.TextIOWrapper(z.open(name), "utf-8-sig")):
        pop[row["UCL_CODE_2021"].removeprefix("UCL")] = int(row["Tot_P_P"])

def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower().replace("saint ", "st ").replace("mount ", "mt ")).strip()

# GeoNames populated places, by normalised name (and alternate names)
gn = defaultdict(list)
with zipfile.ZipFile(f"{src}/AU.zip") as z:
    for line in io.TextIOWrapper(z.open("AU.txt"), "utf-8"):
        f = line.rstrip("\n").split("\t")
        if f[6] != "P":
            continue
        rank = {"PPLC": 0, "PPLA": 1, "PPLA2": 2, "PPL": 3}.get(f[7], 4)
        rec = (rank, -int(f[14] or 0), float(f[5]), float(f[4]))
        for n in {f[1], f[2]}:
            gn[norm(n)].append(rec)

def display(n):
    m = re.match(r"^(.*?) \((.*) Part\)$", n)
    if m:
        n = m.group(2)
    for _ in range(2):  # "Richmond (L) (Tas.)"
        n = re.sub(r" \((L|NSW|Vic\.|Qld|SA|WA|Tas\.|NT|ACT|OT)\)$", "", n)
    # a joined centre ("Shepparton - Mooroopna", "Mareeba - South") goes by its first town
    return n.split(" - ")[0]

r = shapefile.Reader(f"{src}/UCL_2021_AUST_GDA2020")
places, by_gn = [], 0
for sr in r.iterShapeRecords():
    rec = sr.record.as_dict()
    code, raw = rec["UCL_CODE21"], rec["UCL_NAME21"]
    if re.match(r"^(Remainder|Migratory|No usual address)", raw) or not sr.shape.points:
        continue
    p = pop.get(code, 0)
    if p < 200:
        continue
    nm = display(raw)
    geom = shape(sr.shape.__geo_interface__)
    near = prep(geom.buffer(0.03))  # ~3 km
    pt = None
    for _, _, x, y in sorted(gn.get(norm(nm), [])):
        if near.contains(Point(x, y)):
            pt = (x, y)
            by_gn += 1
            break
    if pt is None:
        big = max(geom.geoms, key=lambda g: g.area) if geom.geom_type == "MultiPolygon" else geom
        c = polylabel(big, tolerance=0.0005)
        pt = (c.x, c.y)
    x0, y0, x1, y1 = geom.bounds
    places.append([nm, round(pt[0], 4), round(pt[1], 4), p, STATE[rec["STE_CODE21"]], [round(x0, 3), round(y0, 3), round(x1, 3), round(y1, 3)]])

# one name to a state: a split locality ("Mareeba - South") or a second
# "Richmond" in the state keeps only its biggest
places.sort(key=lambda q: -q[3])
seen = set()
places = [q for q in places if not ((q[0], q[4]) in seen or seen.add((q[0], q[4])))]
json.dump({"src": "ABS 2021 Urban Centres and Localities (Census populations); GeoNames town points", "p": places},
          open(out, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(places)} places, {by_gn} at GeoNames points, {len(places) - by_gn} at polylabel ->", out)
