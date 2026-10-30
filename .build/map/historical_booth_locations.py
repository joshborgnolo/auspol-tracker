#!/usr/bin/env python3
"""Match 1993/96/98 names to later AEC venues; every coordinate is an estimate.

Offline, standard-library build from committed inputs. Never geocode a mobile
team, select an arbitrary duplicate, or put a locality centroid at a venue.
Run this after building the three result frames. Builders subsequently consume
the saved identity-keyed matches via apply_locations().
"""
import collections
import hashlib
import json
import math
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[2]
STORE = ROOT / 'data/booth-locations-history.json'
YEARS = (1993, 1996, 1998)
SOURCE_YEARS = (2007, 2010, 2013, 2016, 2019, 2022, 2025)
SPECIAL = re.compile(r'\b(hospital|mobile|team|pre[ -]?poll|ppvc|absent|postal|provisional)\b', re.I)
CAPITALS = {'sydney', 'melbourne', 'brisbane', 'adelaide', 'perth', 'hobart', 'canberra', 'darwin'}
VENUE_SUFFIX = re.compile(r'^(public school|primary school|high school|school|community (hall|centre|center|school)|town hall|memorial hall|catholic (church|school)|anglican (church|school)|uniting church|baptist church|presbyterian church|methodist church|church|hall)\b')


def norm(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r"['’]", '', s)
    s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
    return re.sub(r'\bmt\b', 'mount', s)


def without_division(name, division):
    return re.sub(r'\s*\(' + re.escape(division) + r'\)\s*$', '', name, flags=re.I)


def read(path):
    return json.loads(path.read_text())


def write(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + '\n')


def ring_contains(ring, x, y):
    inside = False
    for a, b in zip(ring, ring[1:] + ring[:1]):
        ax, ay, bx, by = a[0], a[1], b[0], b[1]
        if (ay > y) != (by > y) and x < ax + (bx-ax)*(y-ay)/(by-ay):
            inside = not inside
    return inside


def boundaries(path):
    t = read(path)
    assert t['handbook'] and 'transform' not in t
    out = {}
    for g in t['objects']['divs']['geometries']:
        assert g['type'] == 'MultiPolygon'
        polys = []
        for poly in g['arcs']:
            rings = []
            for refs in poly:
                ring = []
                for a in refs:
                    arc = t['arcs'][a] if a >= 0 else list(reversed(t['arcs'][~a]))
                    ring.extend(arc if not ring else arc[1:])
                rings.append(ring)
            xs, ys = [p[0] for p in rings[0]], [p[1] for p in rings[0]]
            polys.append(((min(xs), min(ys), max(xs), max(ys)), rings))
        out[g['properties']['name']] = polys
    return out


def contains(polys, lon, lat):
    for (x0, y0, x1, y1), rings in polys:
        if x0 <= lon <= x1 and y0 <= lat <= y1 and ring_contains(rings[0], lon, lat):
            if not any(ring_contains(r, lon, lat) for r in rings[1:]):
                return True
    return False


def distance(a, b):
    # Metres, local equirectangular distance: only used for a 100 m tolerance.
    lat = math.radians((a['lat'] + b['lat']) / 2)
    return 111195 * math.hypot(a['lat'] - b['lat'], (a['lon'] - b['lon']) * math.cos(lat))


def choose(candidates, polys):
    """Earliest year inside the historical division; preserve all duplicates.

    Ambiguous earliest records are rejected, never replaced by a convenient
    later year. Later movement does not establish the historical venue: all
    accepted points remain explicitly approximate.
    """
    inside = [b for b in candidates if contains(polys, b['lon'], b['lat'])]
    if not inside:
        return None, 'outside-division' if candidates else 'no-name-match'
    year = min(b['year'] for b in inside)
    first = [b for b in inside if b['year'] == year]
    if any(distance(a, b) > 100 for i, a in enumerate(first) for b in first[i+1:]):
        return None, 'ambiguous'
    return min(first, key=lambda b: (b['div'], b['boothId'])), 'matched'


def match(name, state, kind, division, index, geom):
    if kind != 1 or SPECIAL.search(name):
        return None, 'non-fixed-place'
    # AEC disambiguators such as "Oatley (Barton)" name the division, not venue.
    original = name
    name = without_division(name, division)
    key = norm(name)
    # Repeated city returns allocated to many divisions are not local venues:
    # e.g. Sydney (Bradfield) must never become Sydney Korean Community Church.
    if name != original and key in CAPITALS:
        return None, 'administrative-place'
    if len(key) < 4:
        return None, 'short-name'
    exact = index.get((state, key), [])
    if exact:
        picked, status = choose(exact, geom)
        return ({**picked, 'method': 'exact-name'} if picked else None), status
    # Whole-word prefix only: "Hannans Road" -> "Hannans Road Public School".
    # Never substring-match York to Yorketown, or drop directional qualifiers.
    candidates = [b for (st, nm), bs in index.items()
                  if st == state and key not in CAPITALS and nm.startswith(key + ' ')
                  and VENUE_SUFFIX.match(nm[len(key)+1:]) for b in bs]
    picked, status = choose(candidates, geom)
    return ({**picked, 'method': 'name-prefix'} if picked else None), status


def apply_locations(doc, store=None):
    if doc['year'] not in YEARS:
        return
    store = store or read(STORE)
    saved = store['elections'][str(doc['year'])]
    B = doc['booths']
    assert len(saved['places']) == len(B['id'])
    B['location'] = []
    for j, bid in enumerate(B['id']):
        rec = saved['places'][str(bid)]
        assert (rec['division'], rec['name']) == (doc['divs'][B['d'][j]]['n'], B['n'][j])
        m = rec['match']
        B['lat'][j], B['lon'][j] = (m['lat'], m['lon']) if m else (None, None)
        # Keep later venue names out of the historical address field.
        B['location'].append([m['year'], m['venue'], m['method']] if m else None)
    coverage = doc.setdefault('coverage', {})
    coverage.update(boothCoordinates='approximate', boothLocationCounts=saved['counts'],
        note=f"{saved['counts'].get('matched', 0):,} of {len(B['id']):,} polling-place records have approximate locations matched to later AEC venues and checked against this election’s boundaries. Unresolved places and mobile teams have no marker. Census figures are unavailable.")


def main():
    index = collections.defaultdict(list)
    files = {}
    for y in SOURCE_YEARS:
        path = ROOT / f'data/booth-seifa-{y}.json'
        files[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()
        for b in read(path)['booths']:
            if b['type'] != 'Polling place' or not b.get('lat') or not b.get('lon') or SPECIAL.search(b['booth']):
                continue
            # 2004's coordinates are themselves carried back from 2007; start
            # at the actual coordinate source year instead of claiming 2004.
            assert not b.get('coordsFrom'), (y, b['booth'])
            rec = {k:b[k] for k in ('div', 'boothId', 'booth', 'venue', 'lat', 'lon')}
            rec['year'] = y
            for key in {norm(without_division(b['booth'], b['div'])), norm(b['venue'])} - {''}:
                index[b.get('premisesState') or b['state'], key].append(rec)
    store = {'method':'Later AEC name matches, state scoped and inside the historical division; earliest matching year, all same-year candidates within 100 m. Exact normalized names before restricted school/hall/church suffixes. Every coordinate is approximate; no centroid fallback, administrative city return or mobile-team point.',
             'sourceSHA256':files, 'elections':{}}
    docs = {}
    for y in YEARS:
        doc = read(ROOT / f'map/data/res-{y}.json'); docs[y] = doc
        path = ROOT / f'map/data/geo-{y}-lo.json'
        store['sourceSHA256'][str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()
        geom = boundaries(path)
        places, counts = {}, collections.Counter()
        B = doc['booths']
        for j, bid in enumerate(B['id']):
            d = doc['divs'][B['d'][j]]
            hit, status = match(B['n'][j], d['st'], B['ty'][j], d['n'], index, geom[d['n']])
            counts[status] += 1
            places[str(bid)] = {'division':d['n'], 'name':B['n'][j], 'status':status, 'match':hit}
        store['elections'][str(y)] = {'counts':dict(counts), 'places':places}
        print(y, dict(counts), flush=True)
    write(STORE, store)
    for y, doc in docs.items():
        apply_locations(doc, store)
        write(ROOT / f'map/data/res-{y}.json', doc)


if __name__ == '__main__':
    main()
