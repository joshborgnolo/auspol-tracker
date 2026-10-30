#!/usr/bin/env python3
"""Adversarial location matching cases, independent of production counts."""
from historical_booth_locations import choose, match, contains, without_division

ring = [[150,-35],[151,-35],[151,-34],[150,-34],[150,-35]]
hole = [[150.4,-34.6],[150.6,-34.6],[150.6,-34.4],[150.4,-34.4],[150.4,-34.6]]
geom = [((150,-35,151,-34), [ring, hole])]
def rec(lon=150.1, lat=-34.1, year=2007, bid=1):
    return dict(lon=lon,lat=lat,year=year,div='Example',boothId=bid)

a = rec(); far = rec(150.2,bid=2); near = rec(150.1001,bid=3)
assert choose([a,far],geom) == (None,'ambiguous'), 'retain same-year duplicate names'
assert choose([a,near],geom)[0] == a, 'duplicate returns at one premises are allowed'
assert choose([a,far,rec(year=2010)],geom)[1] == 'ambiguous', 'later records cannot resolve earlier ambiguity'
assert not contains(geom,150.5,-34.5), 'holes are outside the division'
assert choose([rec(150.5,-34.5)],geom)[1] == 'outside-division'
assert choose([rec(152)],geom)[1] == 'outside-division'
assert without_division('Oatley (Barton)','Barton') == 'Oatley'
assert match('Sydney (Example)','NSW',1,'Example',{('NSW','sydney korean community church'):[a]},geom)[1] == 'administrative-place'
assert match('Hospital Team 1','NSW',1,'Example',{},geom)[1] == 'non-fixed-place'
assert match('Springfield','NSW',1,'Example',{('VIC','springfield'):[a]},geom)[0] is None
assert match('York','NSW',1,'Example',{('NSW','yorketown'):[a]},geom)[0] is None
assert match('Springfield','NSW',1,'Example',{('NSW','springfield north'):[a]},geom)[0] is None
assert match('Hannans Road','NSW',1,'Example',{('NSW','hannans road public school'):[a]},geom)[0]['method'] == 'name-prefix'
print('PASS: location ambiguity, holes, state scope, mobile teams and misleading name prefixes')
