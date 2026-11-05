#!/usr/bin/env python3
"""wa17's past join (the 2013 election) — see build_wa_past_common.py and
.build/map/src/wa/past-adjudication.md.

usage: python3 -I .build/map/build_wa17_data.py map/data
       python3 -I .build/map/build_wa17_past.py map/data
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_wa_past_common import past_main

past_main("wa17")
