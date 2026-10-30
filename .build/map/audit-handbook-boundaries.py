#!/usr/bin/env python3
"""Audit Handbook boundaries without adding them to the published map.

Requires shapely>=2 and pyproj. From the repository root:
  python .build/map/audit-handbook-boundaries.py --fetch
  python .build/map/audit-handbook-boundaries.py

Downloaded and assembled geometry stays in ignored .matilda/ scratch space.
The checked-in JSON report contains metrics, source identifiers and hashes only.
The CSV/API dates are YEARS: this selector rejects transition-year elections.
Invalid geometry is made valid ONLY in memory for diagnostic measurements;
the candidate GeoJSON files preserve the original polygons and coordinates.
"""
import argparse
import collections
import concurrent.futures
import csv
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sqlite3
import subprocess
import time
import urllib.parse
import urllib.request

import pyproj
import shapely
from shapely.geometry import shape, mapping, box, Polygon
from shapely.ops import transform, unary_union
from shapely.validation import explain_validity

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.matilda/handbook-boundaries'
SOURCE = CACHE / 'source'
REVISION = 'fb76072cfa5edb6fa52e557694efdc85954ace31'
REPO_URL = 'https://github.com/wragge/historical-federal-electorate-boundaries'
RAW = f'https://raw.githubusercontent.com/wragge/historical-federal-electorate-boundaries/{REVISION}'
ELECTIONS = {'1993': '1993-03-13', '1996': '1996-03-02', '1998': '1998-10-03'}
STATES = dict(zip(['New South Wales', 'Victoria', 'Queensland', 'Western Australia',
                  'South Australia', 'Tasmania', 'Australian Capital Territory',
                  'Northern Territory'], ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']))
CHANGED = {'1993': {'VIC', 'QLD', 'ACT'}, '1998': {'WA', 'QLD', 'ACT'}}
GPKG = ROOT / '.matilda/seifa-irsad-abs/dl/asgc/asgc1996.gpkg'
REPORT = ROOT / '.build/map/handbook-boundaries-audit.json'
FRAME = box(112, -44.5, 154.5, -9)  # same main-map extent as geo_build.mjs
# WGS84 KML and GDA94 ABS coordinates projected to Australian Albers for area.
PROJECT_APH = pyproj.Transformer.from_crs(4326, 3577, always_xy=True).transform
PROJECT_ABS = pyproj.Transformer.from_crs(4283, 3577, always_xy=True).transform


def key(s):
    return re.sub('[^a-z]', '', s.lower())


def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def fetch(relative):
    dest = SOURCE / relative
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = RAW + '/' + urllib.parse.quote(relative)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                data = r.read()
            if relative.endswith('.geojson'):
                json.loads(data)
            temp = dest.with_suffix(dest.suffix + '.tmp')
            temp.write_bytes(data)
            temp.replace(dest)
            return
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def select(rows, date):
    year = int(date[:4])
    selected = []
    for row in rows:
        start = int(row['start_date'])
        end = int(row['end_date']) if row['end_date'] else 9999
        if year in (start, end):
            raise ValueError(f'{date}: transition-year index needs independent exact dates: {row}')
        if start < year < end:
            selected.append(row)
    return selected


def polygons(geom):
    if geom['type'] == 'Polygon':
        return [geom['coordinates']]
    if geom['type'] == 'MultiPolygon':
        return geom['coordinates']
    if geom['type'] == 'GeometryCollection':
        return [p for g in geom['geometries'] for p in polygons(g)]
    if geom['type'] == 'Point':
        return []  # optional label point, never a division boundary
    raise ValueError(f"Unexpected geometry: {geom['type']}")


def load_handbook(selected, certified):
    canon = {key(name): name for name in certified}
    assert len(canon) == len(certified)
    features, records, shapes = [], [], {}
    for row in sorted(selected, key=lambda r: (r['state'], r['electorate'])):
        name = canon[key(row['electorate'])]
        state = STATES[row['state']]
        assert certified[name]['state'] == state, (name, state)
        p = SOURCE / 'geojson' / row['geojson_file']
        doc = json.loads(p.read_text())
        coords = [poly for f in doc['features'] for poly in polygons(f['geometry'])]
        assert coords, name
        geom = {'type': 'MultiPolygon', 'coordinates': coords}
        g = shape(geom)
        assert not g.is_empty and all(-180 <= v <= 180 for v in g.bounds), name
        assert name not in shapes, name
        shapes[name] = g
        features.append({'type': 'Feature', 'properties': {'name': name, 'st': state,
                         'map_id': row['map_id']}, 'geometry': geom})
        records.append({**row, 'canonical_name': name, 'sha256': digest(p),
                        'valid': bool(g.is_valid), 'validity': explain_validity(g),
                        'polygon_parts': len(coords), 'bounds': list(g.bounds)})
    return features, records, shapes


def abs_shapes():
    spec = importlib.util.spec_from_file_location('abs1996', ROOT / '.build/map/extract-asgc1996-ced.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with sqlite3.connect(f'file:{GPKG}?mode=ro', uri=True) as conn:
        srs = conn.execute("SELECT srs_id FROM gpkg_geometry_columns WHERE table_name='commonwealth_electoral_division_1996'").fetchone()[0]
        assert srs == 4283, srs
        rows = conn.execute('SELECT SHAPE,CED_NAME_1996,STE_NAME_1996 FROM commonwealth_electoral_division_1996').fetchall()
    result = {}
    for blob, name, state in rows:
        if module.EXCL_RE.search(name or ''):
            continue
        typ, coords = module.parse_geom(blob)
        name = module.CANON.get(name, name)
        result[key(name)] = shape({'type': typ, 'coordinates': coords})
    return result


def measurement_geometry(g, project):
    # Repair for measurements only. Keep source validity problems in the report.
    # Densify in geographic coordinates BEFORE projection. Otherwise a long
    # parallel represented by its endpoints becomes an Albers chord, causing
    # spurious kilometre-wide gaps/overlaps against a densely digitised border.
    clipped = shapely.make_valid(g).intersection(FRAME)
    return shapely.make_valid(transform(project, shapely.segmentize(clipped, 0.01)))


def km2(area):
    return round(area / 1e6, 6)


def topology(geoms, certified):
    names = list(geoms)
    gs = list(geoms.values())
    tree = shapely.STRtree(gs)
    overlaps = []
    for i, g in enumerate(gs):
        for j in tree.query(g, predicate='intersects'):
            if j <= i:
                continue
            area = g.intersection(gs[j]).area
            if area > 100:  # report >=100 m2; no topology snapping or gap filling
                overlaps.append({'a': names[i], 'b': names[j], 'km2': km2(area)})
    merged = unary_union(gs)
    holes = []
    for poly in shapely.get_parts(merged):
        if poly.geom_type != 'Polygon':
            continue
        for ring in poly.interiors:
            area = Polygon(ring).area
            if area > 100:
                holes.append(km2(area))
    return {'overlap_pairs_over_100m2': len(overlaps),
            'pairwise_overlap_km2': round(sum(o['km2'] for o in overlaps), 6),
            'largest_overlaps': sorted(overlaps, key=lambda x: -x['km2'])[:25],
            'enclosed_holes_over_100m2': len(holes),
            'enclosed_holes_km2': round(sum(holes), 6),
            'largest_enclosed_holes_km2': sorted(holes, reverse=True)[:15],
            'union_km2': km2(merged.area)}, merged


def comparison(a, b, state):
    diff = a.symmetric_difference(b).area
    return {'state': state, 'handbook_km2': km2(a.area), 'abs_km2': km2(b.area),
            'symmetric_difference_km2': km2(diff),
            'symmetric_difference_pct_abs': round(100 * diff / b.area, 6),
            'intersection_over_union': round(a.intersection(b).area / a.union(b).area, 8)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true')
    args = parser.parse_args()
    SOURCE.mkdir(parents=True, exist_ok=True)
    if args.fetch:
        fetch('federal_electorate_boundaries.csv')
        fetch('README.md')
    rows = list(csv.DictReader((SOURCE / 'federal_electorate_boundaries.csv').open()))
    selections = {year: select(rows, date) for year, date in ELECTIONS.items()}
    certified = json.loads((ROOT / 'data/division-results.json').read_text())['elections']
    for year, selected in selections.items():
        counts = collections.Counter(STATES[r['state']] for r in selected)
        expected = collections.Counter(r['state'] for r in certified[year].values())
        assert counts == expected, (year, counts, expected)
        assert len(selected) == len(certified[year]), year
        assert {key(r['electorate']) for r in selected} == {key(n) for n in certified[year]}, year
    files = sorted({'geojson/' + r['geojson_file'] for s in selections.values() for r in s})
    if args.fetch:
        print(f'Downloading/checking {len(files)} unique GeoJSON files at {REVISION}', flush=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            for n, _ in enumerate(pool.map(fetch, files), 1):
                if n % 40 == 0:
                    print(f'  {n}/{len(files)} files', flush=True)
    baseline = abs_shapes()
    assert set(baseline) == {key(n) for n in certified['1996']}
    abs96 = {n: measurement_geometry(baseline[key(n)], PROJECT_ABS) for n in certified['1996']}
    basetop, baseunion = topology(abs96, certified['1996'])
    report = {'source': REPO_URL, 'revision': REVISION,
              'index_sha256': digest(SOURCE / 'federal_electorate_boundaries.csv'),
              'results_sha256': digest(ROOT / 'data/division-results.json'),
              'abs_gpkg_sha256': digest(GPKG),
              'runtime': {'shapely': shapely.__version__, 'pyproj': pyproj.__version__},
              'date_precision': 'year; transition-year elections rejected',
              'area_crs': 'EPSG:3577', 'measurement_extent': list(FRAME.bounds),
              'preprojection_max_segment_degrees': 0.01,
              'invalid_geometry_policy': 'make_valid for diagnostic measurements only; source files unchanged',
              'holes_caveat': 'Enclosed holes can be lakes or intentional exclusions. Missing coverage is also measured against ABS1996.',
              'publication_status': 'research only; geometry not added to public assets',
              'abs1996_topology': basetop, 'elections': {}}
    assembled = {}
    for year, selected in selections.items():
        print(f'Analysing {year}', flush=True)
        features, records, raw = load_handbook(selected, certified[year])
        (CACHE / f'n-{year}-handbook.geojson').write_text(json.dumps(
            {'type': 'FeatureCollection', 'features': features}, separators=(',', ':')))
        geoms = {n: measurement_geometry(g, PROJECT_APH) for n, g in raw.items()}
        assembled[year] = (features, raw, geoms)
        topo, union = topology(geoms, certified[year])
        bystate = {}
        for state in STATES.values():
            a = unary_union([g for n, g in geoms.items() if certified[year][n]['state'] == state])
            b = unary_union([g for n, g in abs96.items() if certified['1996'][n]['state'] == state])
            bystate[state] = {'missing_vs_abs1996_km2': km2(b.difference(a).area),
                              'extra_vs_abs1996_km2': km2(a.difference(b).area)}
        report['elections'][year] = {'date': ELECTIONS[year], 'divisions': len(records),
            'state_counts': dict(sorted(collections.Counter(STATES[r['state']] for r in records).items())),
            'names_and_states_match_aec': True, 'invalid_source_geometries': [r['canonical_name'] for r in records if not r['valid']],
            'topology': topo, 'state_coverage_vs_abs1996': bystate, 'selection': records}
        if year == '1996':
            comps = {n: comparison(g, abs96[n], certified[year][n]['state']) for n, g in geoms.items()}
            report['comparison_1996'] = comps
            print('  largest 1996 differences:', sorted(comps, key=lambda n: -comps[n]['symmetric_difference_pct_abs'])[:10], flush=True)
    for year, states in CHANGED.items():
        features, raw, geoms = assembled[year]
        hybrid = {}
        hybrid_features = []
        for f in features:
            n = f['properties']['name']
            state = certified[year][n]['state']
            if state in states:
                hybrid[n] = geoms[n]
                hybrid_features.append(f)
            else:
                hybrid[n] = abs96[n]
                hybrid_features.append({'type': 'Feature', 'properties': {'name': n, 'st': state},
                                        'geometry': mapping(baseline[key(n)])})
        (CACHE / f'n-{year}-hybrid.geojson').write_text(json.dumps(
            {'type': 'FeatureCollection', 'features': hybrid_features}, separators=(',', ':')))
        topo, union = topology(hybrid, certified[year])
        report['elections'][year]['hybrid_abs1996'] = {'handbook_states': sorted(states),
            'topology': topo, 'missing_vs_abs1996_km2': km2(baseunion.difference(union).area),
            'extra_vs_abs1996_km2': km2(union.difference(baseunion).area)}
    # A disagreement with ABS is not automatically a Handbook error. Test
    # whether the ABS layer resembles the *later* WA boundary version instead.
    report['wa_abs1996_against_handbook1998'] = {
        n: comparison(g, abs96[n], 'WA') for n, g in assembled['1998'][2].items()
        if certified['1998'][n]['state'] == 'WA'}
    # Independent election-era membership evidence: the certified 1996 booth
    # assignments, plus a later AEC coordinate locating the same town. The
    # later coordinate is a town-location probe, NOT a claim that the polling
    # venue had exactly that location in 1996.
    booth96 = json.loads((ROOT / 'data/booth-seifa-1996.json').read_text())['booths']
    booth04 = json.loads((ROOT / 'data/booth-seifa-2004.json').read_text())['booths']
    collie96 = [r for r in booth96 if r['state'] == 'WA' and r['booth'].startswith('Collie')]
    collie04 = next(r for r in booth04 if r['state'] == 'WA' and r['booth'] == 'Collie')
    point = shapely.geometry.Point(collie04['lon'], collie04['lat'])
    node_script = ('const fs=require("fs"),t=require("topojson-client");'
                   'const a=JSON.parse(fs.readFileSync("map/data/geo-1996-hi.json"));'
                   'process.stdout.write(JSON.stringify(t.feature(a,a.objects.divs).features'
                   '.find(f=>f.properties.name==="Brand")));')
    published = json.loads(subprocess.check_output(['node', '-e', node_script], cwd=ROOT))
    report['collie_brand_probe'] = {
        '1996_assignments': [{'booth': r['booth'], 'division': r['div'], 'booth_id': r['boothId']} for r in collie96],
        'town_location_probe': [point.x, point.y], 'coordinate_source': 'data/booth-seifa-2004.json; AEC polling place 5061707',
        'handbook1996_brand_contains': bool(assembled['1996'][1]['Brand'].covers(point)),
        'handbook1998_brand_contains': bool(assembled['1998'][1]['Brand'].covers(point)),
        'abs1996_brand_contains': bool(baseline[key('Brand')].covers(point)),
        'published1996_brand_contains': bool(shape(published['geometry']).covers(point)),
        'published1996_geometry_sha256': digest(ROOT / 'map/data/geo-1996-hi.json'),
        'booth_assignments_sha256': digest(ROOT / 'data/booth-seifa-1996.json'),
        'coordinate_source_sha256': digest(ROOT / 'data/booth-seifa-2004.json')}
    REPORT.write_text(json.dumps(report, indent=2) + '\n')
    print(REPORT, flush=True)


if __name__ == '__main__':
    main()
