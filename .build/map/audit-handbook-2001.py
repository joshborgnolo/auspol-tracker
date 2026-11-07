#!/usr/bin/env python3
"""Select/audit the Handbook's 2001 frame, preserving original coordinates.

Requires the same Shapely/pyproj environment as audit-handbook-boundaries.py.
Run with --fetch to obtain missing files from the pinned Sherratt revision.
The baseline is the published ABS-derived geometry before this correction.
"""
import argparse
import collections
import concurrent.futures
import csv
import importlib.util
import json
from pathlib import Path
import subprocess

spec = importlib.util.spec_from_file_location('audit', Path(__file__).with_name('audit-handbook-boundaries.py'))
a = importlib.util.module_from_spec(spec); spec.loader.exec_module(a)
BASELINE = '3eea65671583db209500ab8ade51b2aa52b5f705'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true')
    args = parser.parse_args()
    if args.fetch:
        a.fetch('federal_electorate_boundaries.csv')
    rows = list(csv.DictReader((a.SOURCE / 'federal_electorate_boundaries.csv').open()))
    selected = a.select(rows, '2001-11-10')
    with (a.ROOT / '.build/aec-flow-src/divs-2001.txt').open(encoding='utf-8-sig') as f:
        certified = {r['Division']:{'state':r['State']} for r in csv.DictReader(f,delimiter=';')}
    assert len(selected) == len(certified) == 150
    assert {a.key(r['electorate']) for r in selected} == {a.key(n) for n in certified}
    counts = collections.Counter(a.STATES[r['state']] for r in selected)
    assert counts == collections.Counter(r['state'] for r in certified.values())
    if args.fetch:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(a.fetch, ['geojson/' + r['geojson_file'] for r in selected]))
    fc, records, shapes = a.load_handbook(selected, certified)
    old = subprocess.check_output(['git','show',f'{BASELINE}:map/data/geo-2001-hi.json'], cwd=a.ROOT)
    decode = "const fs=require('fs'),vm=require('vm'),c={};vm.runInNewContext(fs.readFileSync('map/vendor/topojson-client-3.1.0.min.js','utf8'),c);const t=JSON.parse(fs.readFileSync(0));process.stdout.write(JSON.stringify(c.topojson.feature(t,t.objects.divs)));"
    baseline = json.loads(subprocess.check_output(['node','-e',decode],input=old,cwd=a.ROOT))
    old_shapes = {f['properties']['name']:a.shape(f['geometry']) for f in baseline['features']}
    measured = {n:a.measurement_geometry(g,a.PROJECT_APH) for n,g in shapes.items()}
    before = {n:a.measurement_geometry(g,a.PROJECT_APH) for n,g in old_shapes.items()}
    metrics = {n:a.comparison(measured[n],before[n],certified[n]['state']) for n in sorted(shapes)}
    topo, _ = a.topology(measured,certified)
    pairs = {}
    for left,right in [('Kennedy','Leichhardt'),('Grey','Wakefield'),('Lyons','Franklin')]:
        new = measured[left].union(measured[right]); prev = before[left].union(before[right])
        pairs[f'{left}/{right}'] = {'individual_difference_km2':a.km2(measured[left].symmetric_difference(before[left]).area),
                                  'pair_union_difference_km2':a.km2(new.symmetric_difference(prev).area)}
    # Same QLD redistribution in 1998 and 2001: compare identifiers, not area alone.
    earlier = json.loads((a.ROOT / '.build/map/handbook-boundaries-audit.json').read_text())['elections']['1998']['selection']
    qld98 = {r['canonical_name']:r['map_id'] for r in earlier if r['state']=='Queensland'}
    assert qld98 == {r['canonical_name']:r['map_id'] for r in records if r['state']=='Queensland'}
    report = {'source':a.REPO_URL,'revision':a.REVISION,'index_sha256':a.digest(a.SOURCE/'federal_electorate_boundaries.csv'),
              'date':'2001-11-10','date_precision':'year; election strictly inside every interval',
              'state_counts':dict(counts),'selection':records,'baseline_commit':BASELINE,
              'baseline_source':'ABS ASGC 2001 statistical CED layer, previously published hi detail',
              'area_crs':'EPSG:3577','measurement_extent':list(a.FRAME.bounds),'preprojection_max_segment_degrees':0.01,
              'invalid_geometry_policy':'make_valid for diagnostic measurements only; source coordinates unchanged',
              'topology':topo,'comparison':metrics,'shared_boundary_pairs':pairs}
    (a.ROOT/'.build/map/handbook-2001-audit.json').write_text(json.dumps(report,indent=2)+'\n')
    print('2001:',dict(counts),'150 exact division-name joins')
    for n in ['Kennedy','Leichhardt','Grey','Wakefield','Lyons','Franklin','Fairfax']:
        print(n,metrics[n])
    print('Pair checks:',pairs)
    print('Topology:',topo)


if __name__ == '__main__':
    main()
