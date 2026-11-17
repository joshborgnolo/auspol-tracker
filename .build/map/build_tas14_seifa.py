#!/usr/bin/env python3
"""data/tas14-seifa.json — see build_tas_seifa_common.py's header.

usage: python3 -I .build/map/build_tas14_seifa.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_tas_seifa_common

build_tas_seifa_common.seifa_main("tas14")
