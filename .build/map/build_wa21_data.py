#!/usr/bin/env python3
"""data-wa21.json for /map/ — the Western Australian state election of
13 March 2021 (59 Legislative Assembly districts). The emitter is
build_wa_common.py (wa_eis.py's EIS results-API mirror parse); see its
header for sources, doctrine and the lane contract.

usage: python3 -I .build/map/build_wa21_data.py <out_dir>; then geo_build.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_wa_common import data_main

data_main("wa21")
