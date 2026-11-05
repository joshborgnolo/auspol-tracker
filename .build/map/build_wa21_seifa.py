#!/usr/bin/env python3
"""data/wa21-seifa.json — see build_wa_seifa_common.py's header.
usage: python3 -I .build/map/build_wa21_seifa.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_wa_seifa_common

build_wa_seifa_common.seifa_main("wa21")
