#!/usr/bin/env python3
"""wa25's past join (the 2021 election) — see build_wa_past_common.py.

usage: python3 -I .build/map/build_wa25_data.py maps/data
       python3 -I .build/map/build_wa25_past.py maps/data
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_wa_past_common import past_main

past_main("wa25")
