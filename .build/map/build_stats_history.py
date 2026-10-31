#!/usr/bin/env python3
"""Build 1993/1998 map results directly from the committed AEC statistics packs.

Approximate later-venue matches are applied from the audited location store;
no census figures are imputed. 1993 has only
division-level DOP counts beyond first preferences; its HTPPBYPP contains
informal votes only. Missing cells stay null. First preferences are compared
with HCANDS/DIVS; exact 1993 source discrepancies are pinned below. Flows
are withheld where those files disagree. Senate ticket/candidate sums are checked
against the pack's separate ZZ formal/informal/total records at every place.
Run: python3 .build/map/build_stats_history.py
Then: node .build/map/handbook_geo.mjs
"""
import collections as C
import csv
import gzip
import hashlib
import json
from pathlib import Path
import re
import build_map_data as common
from historical_booth_locations import apply_locations

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / '.build/aec-flow-src'
OUT = ROOT / 'map/data'
DECL = {'ABSENT': 'abs', 'PRE POLL': 'pre', 'POSTAL': 'post', 'PROVISIONAL': 'prov'}
BASE = dict(zip(['ACT', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT'], range(100, 900, 100)))
FAMS = ['alp', 'lnp', 'grn', 'onp', 'ind', 'oth']


def rows(name):
    p = SRC / name
    with (gzip.open(p, 'rt', encoding='utf-8-sig') if name.endswith('.gz') else p.open(encoding='utf-8-sig')) as f:
        return list(csv.DictReader(f, delimiter=';'))


def integer(s):
    return int(s) if s not in ('', None) else 0


def norm(s):
    return re.sub('[^a-z0-9]', '', s.lower())


def write(name, obj):
    (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + '\n')


def build(year):
    raw = rows(f'divs-{year}.txt')
    assert len(raw) == {1993: 147, 1998: 148}[year]
    byname = {r['Division']: r for r in raw}
    ids = {}
    for st, base in BASE.items():
        for i, n in enumerate(sorted(n for n, r in byname.items() if r['State'] == st), 1):
            ids[n] = base + i
    candidates = C.defaultdict(list)
    for r in rows(f'hcands-{year}.txt'):
        if int(r['Ballot Position']) < 900:
            candidates[r['Division']].append(r)
    for n, cs in candidates.items():
        cs.sort(key=lambda r: int(r['Ballot Position']))
        assert [int(c['Ballot Position']) for c in cs] == list(range(1, len(cs) + 1))
        assert sum(integer(c['Vote']) for c in cs) == integer(byname[n]['Formal Vote'])
        assert sum(c['Member'] == '#' for c in cs) == 1

    # (division, place) -> count -> ballot position -> source row.
    counts = C.defaultdict(lambda: C.defaultdict(dict))
    for r in rows(f'dop-{year}.csv.gz'):
        key = (r['Division'], r['Polling Place'])
        k, bp = int(r['Count']), int(r['Ballot Position'])
        if bp in counts[key][k]:
            # The 1993 print reuses hospital-team names. Preserve every
            # vote under the printed place name; do not invent venues.
            assert year == 1993 and k == 1 and 'Hospital' in key[1], (year, key, k, bp)
            counts[key][k][bp]['Vote'] = str(integer(counts[key][k][bp]['Vote']) + integer(r['Vote']))
        else:
            counts[key][k][bp] = r
    sums = C.defaultdict(C.Counter)
    types = C.defaultdict(C.Counter)
    for (n, pp), ck in counts.items():
        if pp == 'DIVISION SUMMARY':
            continue
        for bp, r in ck[1].items():
            sums[n][bp] += integer(r['Vote'])
            types[n][DECL.get(pp, 'ord')] += integer(r['Vote'])
    discrepancies = sorted((n, int(c['Ballot Position']), sums[n][int(c['Ballot Position'])], integer(c['Vote']))
                           for n, cs in candidates.items() for c in cs if sums[n][int(c['Ballot Position'])] != integer(c['Vote']))
    if year == 1998:
        assert not discrepancies, discrepancies
    else:
        # 1993's DOP figures differ from HCANDS. Keep certified
        # division totals and the printed booth figures; never allocate the
        # difference to an invented polling place or alter a candidate count.
        assert hashlib.sha256(json.dumps(discrepancies, separators=(',', ':')).encode()).hexdigest() == '3f83d4685cb2c13e001df42313d00131004000fdb201bda5776a360a2f203a17', discrepancies
    for n in candidates:
        assert sum(types[n].values()) == sum(sums[n].values())
    # The independently packed first-preference lane must reproduce every cell.
    fpv = C.Counter()
    for r in rows(f'booth/fpv/{year}.csv.gz'):
        fpv[r['Division'], r['Polling Place'], int(r['Ballot Position'])] += integer(r['Vote'])
    for (n, pp, bp), v in fpv.items():
        assert v == integer(counts[n, pp][1][bp]['Vote'])

    count_discrepancies = []
    def final(n, ck, pair=None):
        last = ck[max(ck)]
        if pair is None:
            pair = sorted(sorted(last, key=lambda bp: -integer(last[bp]['Vote']))[:2])
        flow = C.defaultdict(C.Counter)
        for k in sorted(ck)[1:]:
            cr = ck[k]
            exited = [bp for bp, r in cr.items() if r['Candidate Status'] == 'X']
            assert len(exited) == 1, (year, n, k, exited)
            x = exited[0]
            before = ck[sorted(ck)[sorted(ck).index(k) - 1]]
            distributed = sum(integer(r['Vote Distributed']) for bp, r in cr.items() if bp != x)
            exhausted = sum(integer(r['Exhausted Transfer']) for r in cr.values())
            if integer(before[x]['Vote']) != distributed + exhausted:
                assert year == 1993, (year, n, k, 'exclusion')
                count_discrepancies.append([n, k, 'exclusion', integer(before[x]['Vote']), distributed + exhausted])
            for dest in pair:
                if dest != x:
                    flow[x][dest] += integer(cr.get(dest, {}).get('Vote Distributed'))
        tcp = [integer(ck[1][bp]['Vote']) + sum(f[bp] for f in flow.values()) for bp in pair]
        printed = [integer(last.get(bp, {}).get('Vote')) for bp in pair]
        if tcp != printed:
            assert year == 1993, (year, n, 'final piles', tcp, printed)
            count_discrepancies.append([n, 'final', tcp, printed])
            return pair, printed, []  # no fabricated balancing transfers
        return pair, tcp, [[bp - 1, f[pair[0]], f[pair[1]]] for bp, f in sorted(flow.items()) if any(f.values())]

    history = common.build_history()
    D, index, pairs = [], {}, {}
    party_names = {}
    for line in (SRC / 'party-codes-1993-1998.txt').read_text(encoding='cp1252').splitlines():
        cells = line.split('\t')
        if len(cells) >= 2 and cells[0] and cells[1]:
            party_names[cells[0].rstrip('*')] = cells[1]
    previous = json.loads((OUT / 'res-1996.json').read_text()) if year == 1998 else None
    prev_winners = {d['n']: next(c[0] for c in d['c'] if c[6]) for d in previous['divs']} if previous else {}
    classes = json.loads((ROOT / 'data/division-classifications.json').read_text())['elections'].get(str(year), {})
    for n in sorted(ids, key=ids.get):
        r, cs = byname[n], candidates[n]
        pair, tcp, flows = final(n, counts[n, 'DIVISION SUMMARY'])
        if any(x[0] == n for x in discrepancies) or any(x[0] == n for x in count_discrepancies):
            flows = []
        pairs[n] = pair
        winner = int(next(c for c in cs if c['Member'] == '#')['Ballot Position'])
        assert pair[tcp.index(max(tcp))] == winner, (year, n, 'winner')
        crows = []
        for c in cs:
            surname, _, given = c['Candidate'].partition(', ')
            name = common.title_name(given, surname)
            crows.append([name, c['Party'] or 'IND', party_names.get(c['Party'], c['Party']) or 'Independent', common.bucket(c['Party']), integer(c['Vote']), common.fnum(c['Swing']), int(c['Member'] == '#'), int(prev_winners.get(n) == name) if previous else None])
        a, co = integer(r['ALP TPP Vote']), integer(r['Coalition TPP Vote'])
        # Newcastle 1998 has no ALP/Coalition count: neither zero nor 50%.
        assert not (a + co) or a + co + integer(r['TPP Exhausted']) == integer(r['Formal Vote'])
        index[n] = len(D)
        D.append({'id': ids[n], 'n': n, 'st': r['State'], 'cls': classes.get(n, {}).get('classification'),
                  'c': crows, 'inf': integer(r['Informal Vote']), 'vt': {**types[n], 'ppvc': 0},
                  'tcp': [[pair[i] - 1, tcp[i]] for i in range(2)], 'fl': flows,
                  'tpp': [a, co, common.fnum(r['ALP Swing'])] if a + co else None,
                  'seifa': {}, 'h': history.get(n, [])})

    places = {n: sorted(pp for nn, pp in counts if nn == n and pp not in DECL and pp != 'DIVISION SUMMARY') for n in ids}
    pids = {(n, pp): ids[n] * 10000 + i for n in ids for i, pp in enumerate(places[n], 1)}
    htpp = rows(f'htpp-{year}.txt')
    ht = {}
    for r in htpp:
        n, pp = r['Division'], r['Polling Place']
        if pp not in DECL:
            matches = [p for p in places[n] if p == pp] or [p for p in places[n] if norm(p).startswith(norm(pp))]
            if not matches and not any(integer(r.get(k)) for k in ['ALP TPP Vote', 'Coalition TPP Vote', 'Informal Vote', 'TPP Exhausted']):
                continue
            assert len(matches) == 1, (year, n, pp, matches)
            pp = matches[0]
        if (n, pp) in ht:
            assert year == 1993 and 'Hospital' in pp, (year, n, pp)
            ht[n, pp]['Informal Vote'] = str(integer(ht[n, pp]['Informal Vote']) + integer(r['Informal Vote']))
        else:
            ht[n, pp] = r
    informal_differences = []
    if htpp:
        for n, r in byname.items():
            for col in (['ALP TPP Vote', 'Coalition TPP Vote', 'Informal Vote'] if year == 1998 else ['Informal Vote']):
                got = sum(integer(t[col]) for (nn, pp), t in ht.items() if nn == n)
                if year == 1998 and n == 'Newcastle' and col == 'Informal Vote':
                    assert got == 0 and year == 1998  # absent from the TPP product
                elif year == 1998 and n == 'Reid' and col == 'Informal Vote':
                    assert (got, integer(r[col])) == (5465, 5468) and year == 1998
                elif year == 1993 and got != integer(r[col]):
                    informal_differences.append([n, got, integer(r[col])])
                else:
                    assert got == integer(r[col]), (year, n, col)
    if year == 1993:
        assert hashlib.sha256(json.dumps(sorted(informal_differences), separators=(',', ':')).encode()).hexdigest() == '553c9fe55044c052ca33943c2eb0e0106c43e118b34aaff11ab357ddcf44a59e'
    B = {k: [] for k in ['d', 'id', 'n', 'ty', 'prem', 'sub', 'pc', 'lat', 'lon', 'v', 'inf', 'tpp', 'tcp', 'fl', 'dec', 'vdec']}
    for n in sorted(ids, key=ids.get):
        for pp in places[n]:
            ck = counts[n, pp]
            votes = [integer(ck[1][bp]['Vote']) for bp in range(1, len(candidates[n]) + 1)]
            t = ht.get((n, pp))
            a, co = (integer(t.get('ALP TPP Vote')), integer(t.get('Coalition TPP Vote'))) if t else (0, 0)
            if t and a + co:
                assert a + co + integer(t['TPP Exhausted']) == sum(votes), (year, n, pp, 'booth formal')
            tcp = flows = None
            if year == 1998:
                _, tcp, flows = final(n, ck, pairs[n])
            b = dict(d=index[n], id=pids[n, pp], n=pp, ty=2 if 'Hospital' in pp else 3 if 'Mobile' in pp else 1,
                     prem='', sub='', pc='', lat=None, lon=None, v=votes,
                     inf=integer(t['Informal Vote']) if t else None,
                     tpp=[a, co, common.fnum(t['ALP Swing'])] if a + co else None,
                     tcp=tcp, fl=flows, dec=None, vdec=None)
            for k in B:
                B[k].append(b[k])
    A = {}
    for st in ['AUS'] + common.STATES:
        ds = [d for d in D if st == 'AUS' or d['st'] == st]
        prim, seats = C.Counter(), C.Counter()
        for d in ds:
            for c in d['c']:
                prim[c[3]] += c[4]
                if c[6]:
                    seats[c[1]] += 1
        a = sum(d['tpp'][0] for d in ds if d['tpp'])
        co = sum(d['tpp'][1] for d in ds if d['tpp'])
        prior = previous['agg'][st] if previous else None
        sw = 100 * a / (a + co) - 100 * prior['tpp'][0] / sum(prior['tpp'][:2]) if prior else None
        A[st] = dict(prim={f: prim[f] for f in FAMS}, pprim=prior['prim'] if prior else None,
                     formal=sum(prim.values()), pformal=prior['formal'] if prior else None,
                     inf=sum(d['inf'] for d in ds), tpp=[a, co, round(sw, 2) if sw is not None else None], seats=dict(seats))
    doc = dict(year=year, event=None, date={1993:'1993-03-13', 1998:'1998-10-03'}[year], prev={1993:1990, 1998:1996}[year],
               speaker={1993:'Cunningham', 1998:'Wakefield'}[year], agg=A, divs=D, booths=B,
               seifaCuts={k:None for k in ['irsad','irsd','ier','ieo']}, demoBasis=None, incomeCuts=None, cobKeys=None,
               coverage={'boothCoordinates':False, 'boothInformal':True, 'boothPreferences':year == 1998,
                         'firstPreferenceDifferences': discrepancies, 'countDiscrepancies':count_discrepancies,
                         'informalDifferences': informal_differences,
                         'note':'Polling-place names and votes are from the AEC statistics pack. Historical venue coordinates are unavailable in this source; these polling places are not plotted. Census figures are unavailable.'})
    apply_locations(doc)
    with_demo(doc, year)
    with_seifa(doc, year)
    write(f'data-{year}.json', doc)
    senate(year, byname, pids)
    print(year, len(D), 'divisions;', len(pids), 'polling places;', A['AUS']['seats'])





def with_demo(doc, year):
    """Attach the Census People lanes to the statistics-era frame:
    data/booth-demo-<year>.json is the measured census store (its
    venue-CD lookups rode the location store's coordinates on the era
    census districts); the intercensal-blend `.demoI` blocks and its
    demoInterp record interpolate the lanes between the bracketing
    censuses to election day. Division rows are each division's exact
    census CD sum; booth rows compose like the GCP era's. Emission is
    parity with build_map_data's per-year rows for 1996-onward (same
    cell keys), so people-lens and card copy treat this frame like
    the modern ones with the seats era's caveat joining the coverage
    note."""
    p = ROOT / f'data/booth-demo-{year}.json'
    if not p.exists():
        doc['coverage']['census'] = 'unavailable'
        return
    store = json.loads(p.read_text(encoding='utf-8'))
    if 'demoInterp' not in store:
        # the interp pass runs after the store derives; a half-ready
        # measured store weaves in measured rows only, no cells, so the
        # page reads exactly 'no census figure here', never an epoch-
        # mismatched blend
        doc['coverage']['census'] = (
            f"measured-only ({store.get('censusEdition')}) "
            "— interp not yet run on this store")
    by_div = {dv['div']: dv for dv in store['divisions']}
    by_booth = {b['boothId']: b for b in store['booths']}

    def cells(block, iblk):
        dm = common.demo_interp_of(block, iblk)
        return common.demo_cells(dm) if dm else None

    n_div = n_booth = 0
    for d in doc['divs']:
        dv = by_div.get(d['n'])
        if not dv or dv.get('persons') in (None, 0):
            continue
        dc = cells(dv, dv.get('demoI'))
        if not dc:
            continue
        d['demo'] = {'lang': dc[0], 'a65': dc[1], 'a2034': dc[2],
                     'fborn': dc[3], 'uni': dc[4], 'blue': dc[5],
                     'p': dv.get('persons'),
                     'loinc': dc[6], 'hiinc': dc[7], 'medIncWeekly': None,
                     'cob': dv.get('cob'),
                     'y12less': dc[8], 'atsci': dc[9], 'u15': dc[10],
                     'onepar': dc[11], 'rel': dv.get('rel'),
                     'ten': dv.get('ten')}
        n_div += 1
    dcol = []
    for bid in doc['booths']['id']:
        vb = by_booth.get(bid)
        blk = (vb or {}).get('demo')
        dcol.append(cells(blk, (vb or {}).get('demoI')) if blk else None)
    if any(x is not None for x in dcol):
        doc['booths']['demo'] = dcol
        n_booth = sum(x is not None for x in dcol)
    # the follow-on people cohorts of the 90s people-lane arc
    # (birthplace-country menu, religion, tenure): the stats frame rides
    # the measured census side's own menu (era print intersections,
    # never an invented row), and the GCP-era era print holes ride null
    # figures end-to-end. Menu keys only emit when the era can offer
    # them — no empty menus.
    cobkeys = store.get('cobKeys')
    if cobkeys:
        doc['cobKeys'] = list(cobkeys)
    relkeys = store.get('relKeys')
    if relkeys:
        doc['relKeys'] = list(relkeys)
    tenkeys = store.get('tenKeys')
    if tenkeys:
        doc['tenKeys'] = list(tenkeys)
    n_cob = n_rel = n_ten = 0
    for bid in doc['booths']['id']:
        vb = by_booth.get(bid)
        blk = (vb or {}).get('demo')
        cob_b = (blk or {}).get('cob')
        rel_b = (blk or {}).get('rel')
        ten_b = (blk or {}).get('ten')
        c_row = [cob_b.get(k) for k in cobkeys] if (cobkeys and isinstance(cob_b, dict)) else None
        r_row = [rel_b.get(k) for k in (relkeys or [])] if (relkeys and isinstance(rel_b, dict)) else None
        t_row = [ten_b.get(k) for k in (tenkeys or [])] if (tenkeys and isinstance(ten_b, dict)) else None
        doc['booths'].setdefault('cob', []).append(c_row)
        doc['booths'].setdefault('rel', []).append(r_row)
        doc['booths'].setdefault('ten', []).append(t_row)
        n_cob += (c_row is not None)
        n_rel += (r_row is not None)
        n_ten += (t_row is not None)
    for kk in ('cob', 'rel', 'ten'):
        if not any(x is not None for x in doc['booths'][kk]):
            del doc['booths'][kk]
    doc['demoBasis'] = 'venue'
    if store.get('demoInterp'):
        doc['demoInterp'] = store['demoInterp']
    doc['coverage']['census'] = (
        f"the {store.get('censusEdition')} census on era district "
        f"lines (venue-nearest within 1.5 km, "
        f"{store.get('counts', {}).get('boothsGeoNearest')} of "
        f"{store.get('counts', {}).get('booths')} booths), "
        f"interpolated between censuses to election day")
    doc['coverage']['note'] = (
        doc['coverage']['note'].replace(
            ' Census figures are unavailable.',
            ' Census figures ride the era census districts per '
            'venue-nearest mapping (see coverage.census) — the GCP-era '
            'census demos do not exist at this frame.'))
    print(f"    people lanes: {n_div} divisions, {n_booth} booths "
          f"carried census demo cells; cohort lanes cob {n_cob}, "
          f"rel {n_rel}, ten {n_ten}")


def with_seifa(doc, year):
    """Attach the SEIFA lanes to the statistics-era frame: division cells
    from data/division-seifa-indexes.json (the same store build_map_data
    reads; era blocks via derive-division-seifa-stats90s.py) with
    common.seifa_cells' pcti-before-pct precedence, and the per-booth
    national-decile cells from data/booth-seifa-<year>.json keyed by the
    frame's composite booth ids (the derive gates that registry against
    the assembled frame). seifaCuts uses build_map_data's own midpoint
    recipe so the 90s legend edges line up with the GCP-era lane's; an
    index whose census era lacks it (pre-2001 censuses print no IRSAD)
    keeps a null cut and null cells, never a cross-era substitute."""
    p = ROOT / f'data/booth-seifa-{year}.json'
    if not p.exists():
        return
    bse = json.loads(p.read_text(encoding='utf-8'))
    blocks = json.loads((ROOT / 'data/division-seifa-indexes.json')
                        .read_text(encoding='utf-8'))['elections'].get(str(year)) or {}
    n_div = 0
    for d in doc['divs']:
        blk = blocks.get(d['n'])
        if not blk:
            continue
        cells = common.seifa_cells(blk)
        if cells:
            d['seifa'] = cells
            n_div += 1
    by_booth = {b['boothId']: b for b in bse.get('booths', [])}
    dec = []
    for bid in doc['booths']['id']:
        s = (by_booth.get(bid) or {}).get('seifa') or {}
        dd = s.get('dec') or {}
        dec.append([dd.get(ix) for ix in (
            'irsad', 'irsd', 'ier', 'ieo')] if dd else None)
    doc['booths']['dec'] = dec
    cuts = {}
    for ix in ('irsad', 'irsd', 'ier', 'ieo'):
        lo = C.defaultdict(list)
        for b in by_booth.values():
            s = b.get('seifa')
            if s and s.get(ix) is not None and (s.get('dec') or {}).get(ix):
                lo[s['dec'][ix]].append(s[ix])
        cuts[ix] = [round((max(lo[k]) + min(lo[k + 1])) / 2, 1)
                    for k in range(1, 10)] if all(lo[k] for k in range(1, 11)) else None
    doc['seifaCuts'] = cuts
    n_booth = sum(x is not None and any(v is not None for v in x) for x in dec)
    doc['coverage']['seifa'] = (
        f"the {bse.get('seifaEdition')} census's CD scores via the same "
        f"era districts (era SEIFA cubes; {len(bse.get('indexes') or [])} "
        f"indexes; booth deciles on {n_booth:,} places); "
        f"{bse.get('seifaEdition')} predates IRSAD"
        if bse.get('seifaEdition') in (1991, 1996) else
        f"the {bse.get('seifaEdition')} census's CD scores via the same "
        f"era districts (era SEIFA cubes; booth deciles on {n_booth:,} "
        f"places)")
    print(f"    seifa lanes: {n_div} divisions, {n_booth} booths carried "
          f"SEIFA cells")


def senate(year, divs, pids):
    candidates = {(r['State'], r['Ticket'], int(r['Ballot Position'])):r for r in rows(f'scands-{year}.txt')}
    group = {}
    for (st, ticket, bp), r in candidates.items():
        group[st, ticket] = r['Group'] or r['Party'] or 'IND'
    sums, zz = C.defaultdict(lambda:[0]*7), C.defaultdict(dict)
    for r in rows(f'sppvote-{year}.csv.gz'):
        n, pp, t, bp, v = r['Division'], r['Polling Place'], r['Ticket'], int(r['Ballot Position']), integer(r['Vote'])
        if pp in ('Division Summary', 'Adj'):
            continue
        if t == 'ZZ':
            assert bp not in zz[n, pp]
            zz[n, pp][bp] = v
            continue
        st = divs[n]['State']
        assert bp == 0 or (st, t, bp) in candidates, (year, st, t, bp)
        ab = group[st, t] if bp == 0 else candidates[st, t, bp]['Party']
        # The official code table names JPI as Janet Powell Independents'
        # Network; HAR is Brian Harradine's independent Senate group.
        fam = 'ind' if ab == 'JPI' else 'lnp' if ab == 'LPNP' else common.bucket(ab)
        sums[n, pp][0] += v
        sums[n, pp][1 + FAMS.index(fam)] += v
    for k, z in zz.items():
        assert z[998] + z[999] == z[1000] and sums[k][0] == z[998], (year, k, z, sums[k])
    assert set(sums) == set(zz)
    D, B = C.defaultdict(lambda:[0]*7), {}
    for (n, pp), v in sums.items():
        D[n] = [a+b for a,b in zip(D[n], v)]
        pid = pids.get((n, pp))
        if pid is not None:
            B[str(pid)] = v
    assert set(D) == set(divs)
    write(f'senate-vote-{year}.json', dict(year=year, fams=FAMS, divs=D, booths=B))


if __name__ == '__main__':
    for year in [1993, 1998]:
        build(year)
    history = common.build_history()
    for year in common.YEARS:
        target = OUT / f'res-{year}.json'
        doc = json.loads(target.read_text())
        for d in doc['divs']:
            d['h'] = history.get(d['n'], [])
        write(target.name, doc)
