#!/usr/bin/env python3
"""The qld24 frame's previous-election join (build_qld_past_common.py — see
its header for doctrine and the chain order).

usage: python3 -I .build/map/build_qld24_past.py map/data
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_qld_past_common import past_main

past_main("qld24")
